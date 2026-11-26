import type { WebContents } from 'electron'
import { WebContentsView } from 'electron'

import type {
  AiContentInputEvent,
  AiViewAttachRequest,
  AiViewAttachResponse,
  AiViewBounds,
  AiViewEvent,
  AiViewSource,
  AiViewStateSnapshot
} from '../../../shared/types/aiView.js'
import { applyRemoteContentSecurity } from '../../app/window/remoteContentSecurity.js'
import { setupAiSession } from '../../app/window/sessions.js'
import { getMainWindow } from '../../app/windowManager.js'
import { Logger } from '../../core/logger.js'
import { CHROME_USER_AGENT } from '../ai/aiManager.js'
import { installAiViewContextMenu } from './aiViewContextMenu.js'
import { boundsEqual, isUsableBounds, parseBounds, parseViewId } from './aiViewContract.js'
import { type AiViewLoadStateChange, bridgeWebContentsEvents } from './aiViewEventBridge.js'
import { installChatGptShortcutGuard, isChatGptViewPartition } from './aiViewKeyboardGuard.js'
import {
  type AiViewTarget,
  isUrlTrustedForTarget,
  resolveAiViewTarget,
  resolveEntryUrl
} from './aiViewTargets.js'

/**
 * Owns every remote surface the app embeds.
 *
 * A `WebContentsView` is not part of any DOM tree, so its lifetime, geometry
 * and visibility are decided here rather than by React. The renderer owns only
 * a placeholder rectangle and a host token; it can neither name a partition nor
 * address a `WebContents` that this map does not contain.
 */

interface ManagedAiView {
  view: WebContentsView
  webContents: WebContents
  /** Stable key the renderer addresses this view by (an AI tab id or namespaced pdf id). */
  viewId: string
  /** Registry identity this view was resolved from. */
  sourceKey: string
  /**
   * The main-process resolved target. Kept for the lifetime of the view so every
   * later navigation request can be re-validated against the partition this view
   * was actually created in — the renderer never names a partition itself.
   */
  target: AiViewTarget
  partition: string
  /** Mirror of the guest URL, refreshed on every navigation and on every snapshot. */
  currentUrl: string
  /** Mirror of the guest load state; the input to every snapshot this manager hands out. */
  isLoading: boolean
  hasLoadedOnce: boolean
  /** Last main-frame load failure, cleared by the next attempt or the next document. */
  loadError: { code: number; description: string } | null
  generation: number
  visible: boolean
  /** What `setVisible` was last called with, so repeat calls are skipped. */
  shown: boolean
  bounds: AiViewBounds | null
  /**
   * Radius `setBorderRadius` last accepted, or `null` while none has been.
   *
   * Kept apart from `bounds.borderRadius` because the two can disagree: Electron
   * validates the radius as an integer and throws on anything else. Remembering
   * the request instead of the result would make a rejected call permanent — the
   * next geometry message would compare equal and skip the retry, so the view
   * would stay square for its whole lifetime.
   */
  appliedBorderRadius: number | null
  /**
   * Radius whose failure was already logged, so a platform that rejects the API
   * outright does not emit one warning per geometry message — the host now
   * publishes on every frame of a move, not just on resize.
   */
  radiusFailureLogged: number | null
  /** Token of the host placeholder currently allowed to move this view. */
  hostToken: string | null
  /**
   * URL of a renderer-requested navigation whose load has not settled yet.
   *
   * Two hosts can process the same one-shot "open this conversation" request
   * during a focus-mode handoff, and a retry can race the original attempt. The
   * duplicate is dropped only while this exact URL is still in flight, so an
   * explicit reload, a failed load or a later visit to the same URL all keep
   * working. This is per view and time-bounded; it is deliberately not a global
   * "current URL equals request URL" shortcut.
   */
  pendingNavigationUrl: string | null
  pendingNavigationStartedAt: number
  /** Stamp that invalidates the completion of an older navigation attempt. */
  pendingNavigationEpoch: number
  disposeBridge: () => void
  /**
   * Removes the provider shortcut guard from this view's `WebContents`.
   *
   * Bound per view rather than globally: the guard belongs to the guest that
   * has focus, and the next attachment creates a new `WebContents`.
   */
  disposeKeyboardGuard: () => void
  /**
   * Removes the clipboard context menu listener from this view's `WebContents`.
   *
   * Bound per view for the same reason as the shortcut guard: the listener is
   * attached to the guest that was created for this attachment, and a new
   * attachment builds a new `WebContents`.
   */
  disposeContextMenu: () => void
}

const views = new Map<string, ManagedAiView>()
let generationCounter = 0

/**
 * How long an identical navigation may stay "in flight" before a repeat is
 * allowed again.
 *
 * `loadURL` resolves on `did-finish-load`; a page that never settles would
 * otherwise suppress a legitimate retry for the rest of the session. Ten
 * seconds covers the overlap this guard exists for without hiding a real hung
 * load from the user.
 */
const PENDING_NAVIGATION_MAX_AGE_MS = 10_000

/**
 * Per-view tail of the lifecycle queue.
 *
 * Attach and destroy both arrive as independent IPC messages, and attach is not
 * synchronous: it awaits target resolution, which for a custom platform reads
 * the custom-platform store off disk. A destroy that lands in that window finds
 * nothing in `views` — the view does not exist yet — and would be dropped,
 * leaving the attach to finish and create a WebContents for a tab the user has
 * already closed. Serialising per view id makes the final state a function of the
 * message order instead of of how the two awaits interleave.
 *
 * Per id, not global: an unrelated AI tab must not have to wait for another
 * tab's target resolution to finish.
 */
const lifecycleTails = new Map<string, Promise<void>>()

function enqueueLifecycle<T>(viewId: string, run: () => Promise<T> | T): Promise<T> {
  const previous = lifecycleTails.get(viewId) ?? Promise.resolve()
  // `run` on both settled paths: a rejected predecessor (an attach whose target
  // could not be resolved) must not cancel the destroy queued behind it.
  const settled = previous.then(run, run)
  const tail = settled.then(
    () => undefined,
    () => undefined
  )
  lifecycleTails.set(viewId, tail)
  void tail.then(() => {
    // Drop the entry once this view's queue drains so the map cannot grow with
    // every id the user has ever opened.
    if (lifecycleTails.get(viewId) === tail) lifecycleTails.delete(viewId)
  })
  return settled
}

type EventListener = (event: AiViewEvent) => void
const listeners = new Set<EventListener>()

/** Registered once at startup by the IPC layer; fans events out to the renderer. */
export function setAiViewEventSink(sink: EventListener | null): void {
  if (sink) listeners.add(sink)
  else listeners.clear()
}

function emit(event: AiViewEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      Logger.warn('[AiView] Event listener threw:', error)
    }
  }
}

function sourceKeyOf(source: AiViewSource): string {
  return source.kind === 'ai-platform' ? `ai:${source.modelId}` : `google:${source.appId}`
}

function isAlive(entry: ManagedAiView | undefined): entry is ManagedAiView {
  return Boolean(entry) && !entry!.webContents.isDestroyed()
}

export function getManagedAiView(viewId: string): ManagedAiView | null {
  const entry = views.get(viewId)
  return isAlive(entry) ? entry : null
}

export function listManagedAiViewIds(): string[] {
  return [...views.keys()]
}

/**
 * The guest URL as the live `WebContents` reports it.
 *
 * `currentUrl` on the entry is a mirror kept by the event bridge, and a mirror
 * can always be one navigation behind; `getURL()` cannot. It still falls back to
 * the mirror because Chromium answers with an empty string until the first
 * navigation commits, and the entry URL is the honest answer for that window.
 */
function liveUrlOf(entry: ManagedAiView): string {
  try {
    return entry.webContents.getURL() || entry.currentUrl
  } catch {
    return entry.currentUrl
  }
}

/**
 * The single description of a view's state, handed to every host that attaches
 * to it. See `AiViewStateSnapshot` for why a host needs one at all.
 */
function snapshotOf(entry: ManagedAiView): AiViewStateSnapshot {
  return {
    generation: entry.generation,
    currentUrl: liveUrlOf(entry),
    isLoading: entry.isLoading,
    hasLoadedOnce: entry.hasLoadedOnce,
    error: entry.loadError
  }
}

/**
 * Folds a lifecycle transition into the entry's mirror and republishes it when
 * something a host depends on actually changed.
 *
 * The republish is what makes a mounted host self-healing: `sendEvent` drops
 * every event while the window is not ready, so a host can miss the one
 * `did-stop-loading` it was waiting for. A snapshot arriving later restores the
 * truth without the renderer having to re-attach.
 */
function commitLoadState(entry: ManagedAiView, change: AiViewLoadStateChange): void {
  let changed = false

  if (change.currentUrl) entry.currentUrl = change.currentUrl
  if (change.isLoading !== undefined && change.isLoading !== entry.isLoading) {
    entry.isLoading = change.isLoading
    changed = true
  }
  if (change.hasLoadedOnce !== undefined && change.hasLoadedOnce !== entry.hasLoadedOnce) {
    entry.hasLoadedOnce = change.hasLoadedOnce
    changed = true
  }
  if (change.error !== undefined) {
    const before = entry.loadError
    entry.loadError = change.error
    if (before?.code !== entry.loadError?.code) changed = true
    if (before?.description !== entry.loadError?.description) changed = true
  }

  if (!changed) return
  emit({ viewId: entry.viewId, kind: 'state', ...snapshotOf(entry) })
}

/**
 * Clears the in-flight navigation marker for exactly one attempt.
 *
 * The epoch check is what keeps a superseded `loadURL` promise from clearing a
 * newer request's marker when it eventually settles.
 */
function settlePendingNavigation(entry: ManagedAiView, epoch: number): void {
  if (entry.pendingNavigationEpoch !== epoch) return
  entry.pendingNavigationUrl = null
  entry.pendingNavigationStartedAt = 0
}

/**
 * Chrome's desktop user agent keeps provider sites on their desktop layout,
 * which is what the `<webview useragent>` attribute used to do. The manager
 * applies it per view so the renderer cannot override it.
 */
function applyUserAgent(webContents: WebContents): void {
  if (!CHROME_USER_AGENT) return
  try {
    webContents.setUserAgent(CHROME_USER_AGENT)
  } catch (error) {
    Logger.warn('[AiView] Failed to apply user agent:', error)
  }
}

/**
 * The body of an attach, run inside this view's lifecycle slot.
 *
 * Every early return here is a *re-attach* onto a view that is already alive,
 * which is the normal shape of a focus-mode handoff and of a tab coming back
 * from behind AI Home. The snapshot it returns is what tells the new host that
 * the guest has already painted, so the native view can be revealed immediately
 * instead of waiting for a `did-stop-loading` that will never fire again.
 */
function attachResolved(
  viewId: string,
  request: AiViewAttachRequest,
  target: AiViewTarget
): AiViewAttachResponse {
  const sourceKey = sourceKeyOf(request.source)
  const current = views.get(viewId)
  const existing = isAlive(current) ? current : null
  if (existing && existing.sourceKey === sourceKey && existing.partition === target.partition) {
    const window = getMainWindow()
    if (window && !window.isDestroyed()) {
      const children = (window.contentView as unknown as { children?: unknown[] })?.children
      if (Array.isArray(children) && !children.includes(existing.view)) {
        window.contentView.addChildView(existing.view)
      }
    }
    releaseHostClaims(existing)
    return { ...snapshotOf(existing) }
  }
  // A destroyed-but-not-yet-removed entry still owns a child view. Replacing the
  // map slot without retiring it would leave that native child on the window and
  // the old bridge attached for the rest of the session.
  if (current) destroyEntry(viewId)

  const window = getMainWindow()
  if (!window || window.isDestroyed()) throw new Error('main_window_unavailable')

  try {
    setupAiSession(target.partition)
  } catch (error) {
    // Never attach a guest to a partition whose deny-by-default permission
    // policy could not be installed: falling back to Electron defaults would
    // silently grant capabilities the app meant to withhold.
    Logger.error('[AiView] Session security setup failed; refusing to attach the view:', {
      viewId,
      partition: target.partition,
      error
    })
    throw new Error(
      `session_setup_failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const view = new WebContentsView({
    webPreferences: {
      partition: target.partition,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
      navigateOnDragDrop: false,
      plugins: false,
      backgroundThrottling: true
    }
  })

  const webContents = view.webContents
  const generation = ++generationCounter
  const entry: ManagedAiView = {
    view,
    webContents,
    viewId,
    sourceKey,
    target,
    partition: target.partition,
    currentUrl: resolveEntryUrl(target, request.restoredUrl ?? null),
    // The entry load is kicked off below and its `did-start-loading` arrives
    // asynchronously, so the entry starts out already loading. Reporting it as
    // idle would let a host conclude the guest settled with nothing to show.
    isLoading: true,
    hasLoadedOnce: false,
    loadError: null,
    generation,
    visible: false,
    shown: false,
    bounds: null,
    appliedBorderRadius: null,
    radiusFailureLogged: null,
    hostToken: null,
    pendingNavigationUrl: null,
    pendingNavigationStartedAt: 0,
    pendingNavigationEpoch: 0,
    disposeBridge: () => {},
    disposeKeyboardGuard: () => {},
    disposeContextMenu: () => {}
  }

  const disposeBridge = bridgeWebContentsEvents({
    viewId,
    generation,
    webContents,
    emit,
    onLoadStateChange: (change) => {
      // A destroyed view's bridge is detached, but a late event could still be
      // queued; it must not resurrect state in whatever replaced it.
      if (views.get(viewId)?.generation !== generation) return
      commitLoadState(entry, change)
    }
  })
  entry.disposeBridge = disposeBridge

  applyUserAgent(webContents)
  applyRemoteContentSecurity({ webContents, partition: target.partition })
  // ChatGPT's sidebar toggle is the one guest binding that collides with a
  // QuizLab shortcut. Only that provider gets a guard; every other site keeps
  // its own keyboard behaviour. The PDF screenshot accelerator is untouched:
  // it lives on the PDF context menu in the main renderer, not in a guest view.
  if (isChatGptViewPartition(target.partition)) {
    entry.disposeKeyboardGuard = installChatGptShortcutGuard(webContents)
  }
  // A guest page has no context menu of its own in Electron, so every managed
  // view gets the clipboard menu, not just the provider that reported it.
  entry.disposeContextMenu = installAiViewContextMenu(webContents)

  views.set(viewId, entry)
  window.contentView.addChildView(view)
  view.setVisible(false)
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  // `shown` starts false and applyVisibility() only mutes on a state change,
  // so an initially hidden view must be muted explicitly. Otherwise a guest
  // can play audio from attach until its first show (or forever if never shown).
  if (!webContents.isDestroyed()) {
    try {
      webContents.setAudioMuted(true)
    } catch {
      // Older Electron builds may not expose muting; degrade gracefully.
    }
  }

  webContents.once('destroyed', () => {
    entry.disposeKeyboardGuard()
    if (views.get(viewId)?.generation !== generation) return
    // An unexpected `destroyed` (a guest that closed itself, a renderer teardown
    // Electron initiated) leaves the native child of the window behind unless it
    // is retired here. Queue it behind any lifecycle operation already running so
    // this cleanup cannot race a re-attach for the same id.
    void enqueueLifecycle(viewId, () => {
      if (views.get(viewId)?.generation !== generation) return false
      return destroyEntry(viewId)
    })
  })

  const entryUrl = entry.currentUrl
  entry.pendingNavigationUrl = entryUrl
  entry.pendingNavigationStartedAt = Date.now()
  const initialNavigationEpoch = ++entry.pendingNavigationEpoch
  void webContents.loadURL(entryUrl).then(
    () => settlePendingNavigation(entry, initialNavigationEpoch),
    (error: unknown) => {
      settlePendingNavigation(entry, initialNavigationEpoch)
      Logger.warn('[AiView] Initial load failed:', { viewId, error })
    }
  )

  return { ...snapshotOf(entry) }
}

export function attachAiView(request: AiViewAttachRequest): Promise<AiViewAttachResponse> {
  const viewId = parseViewId(request?.viewId)
  if (!viewId) return Promise.reject(new Error('invalid_view_id'))

  return enqueueLifecycle(viewId, async () => {
    const target = await resolveAiViewTarget(request.source)
    if (!target) throw new Error('unknown_view_target')
    return attachResolved(viewId, request, target)
  })
}

/**
 * Drops every claim a host placeholder made on a view.
 *
 * Factored out of `detachAiViewHost` because a re-attach has to do exactly the
 * same thing, and skipping it there is what let a view get stranded. The claims
 * are a mirror of a renderer that may already be gone: the token belongs to
 * whichever host published last, and the rectangle is the one that host measured.
 * Keeping either one means the next host's first message is judged against a
 * previous owner (and can be dropped for that), while keeping `shown` means a
 * message that *is* dropped leaves the previous rectangle painted with nothing
 * left that could correct it.
 */
function releaseHostClaims(entry: ManagedAiView): void {
  entry.hostToken = null
  entry.visible = false
  entry.bounds = null
  applyVisibility(entry)
}

/**
 * Releases a host placeholder's claim without destroying the view.
 *
 * This is what makes a focus-mode switch (or any surface swap) a pure
 * reposition: the same `WebContents` keeps running, so the conversation, the
 * login and the scroll position all survive.
 */
export function detachAiViewHost(viewId: string, hostToken: string): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  if (entry.hostToken !== null && entry.hostToken !== hostToken) return false

  releaseHostClaims(entry)
  return true
}

/**
 * Drops the host claim on every managed view.
 *
 * A renderer reload — a Vite full reload in development, a crash recovery in a
 * packaged build — tears the React tree down without running a single cleanup,
 * so no `detach` ever reaches this process and the mirror goes on describing a
 * renderer that no longer exists. The next renderer starts its host tokens from
 * zero again, so its first geometry message can be rejected against a token
 * belonging to the dead one; and because the sync channel is fire-and-forget it
 * never learns that it lost, which leaves the view painting its old rectangle
 * until something unrelated resizes it.
 *
 * A main-frame navigation is the only moment this process can observe a renderer
 * it did not create going away, so it is treated as "everybody let go". Nothing
 * is destroyed: the guests keep running and the next host re-attaches onto them
 * with the URL and scroll position they had.
 */
export function releaseAllAiViewHosts(): void {
  for (const entry of views.values()) releaseHostClaims(entry)
}

/**
 * Tears a view down synchronously. Only ever called from inside that view's
 * lifecycle slot (or from `destroyAllAiViews`, which drains the queues first), so
 * it cannot race a pending attach for the same id.
 */
function destroyEntry(viewId: string): boolean {
  const entry = views.get(viewId)
  if (!entry) return false
  views.delete(viewId)

  try {
    entry.disposeBridge()
  } catch (error) {
    Logger.warn('[AiView] Failed to detach listeners:', error)
  }

  try {
    entry.disposeKeyboardGuard()
  } catch (error) {
    Logger.warn('[AiView] Failed to remove keyboard guard:', error)
  }

  try {
    entry.disposeContextMenu()
  } catch (error) {
    Logger.warn('[AiView] Failed to remove context menu:', error)
  }

  const window = getMainWindow()
  if (window && !window.isDestroyed()) {
    try {
      window.contentView.removeChildView(entry.view)
    } catch (error) {
      Logger.warn('[AiView] removeChildView failed:', error)
    }
  }

  try {
    entry.view.setVisible(false)
  } catch {
    // View may already be detached.
  }

  if (!entry.webContents.isDestroyed()) {
    // `close()` is Electron's teardown for a WebContents we own: it drops the
    // renderer process instead of leaving an orphaned one behind.
    //
    // Guarded like every other teardown step above. It runs last, once the map
    // entry is already deleted and the view is off the window, so a throw here
    // could not be recovered from anyway — letting it escape would only reject
    // destroyAiView() and make destroyAllAiViews()'s Promise.all bail out
    // before it awaited its siblings.
    try {
      entry.webContents.close()
    } catch (error) {
      Logger.warn('[AiView] webContents.close() failed:', error)
    }
  }

  return true
}

/**
 * Retires a view, queued behind whatever lifecycle operation is already running
 * for the same id. A destroy that arrives while an attach is still resolving its
 * target therefore runs *after* that attach and cannot miss the view it is meant
 * to close.
 */
export function destroyAiView(viewId: string): Promise<boolean> {
  const id = parseViewId(viewId)
  if (!id) return Promise.resolve(false)
  return enqueueLifecycle(id, () => destroyEntry(id))
}

export function destroyAllAiViews(): Promise<void> {
  // Ids with a queued-but-unfinished lifecycle operation are included: their view
  // does not exist yet, so listing `views` alone would let a pending attach
  // create a WebContents during shutdown.
  const ids = new Set([...views.keys(), ...lifecycleTails.keys()])
  return Promise.all([...ids].map((viewId) => destroyAiView(viewId))).then(() => undefined)
}

/**
 * Applies a host placeholder's rectangle and visibility in one step.
 *
 * The message doubles as the ownership claim: a host that is not the current
 * owner is rejected outright, so a stale placeholder that is still mounted
 * during a focus-mode animation can never move the active host's view.
 */
export function syncAiViewHost(
  viewId: string,
  hostToken: string,
  rawBounds: unknown,
  visible: boolean
): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  if (entry.hostToken !== null && entry.hostToken !== hostToken) return false

  const bounds = parseBounds(rawBounds)
  if (!bounds) return false

  const nextRadius = bounds.borderRadius ?? 0
  // Radius first: the clip has to exist before the first frame painted at the
  // new geometry, otherwise the corner is square for one frame. A no-op when the
  // platform already accepted this value.
  ensureBorderRadius(entry, nextRadius)

  if (!visible || !isUsableBounds(bounds)) {
    /*
     * A host that is not showing the view gives up its claim instead of keeping
     * it warm.
     *
     * Keeping the token while hidden is what stranded the view on a focus-mode
     * handoff: the exiting overlay keeps its props for the whole exit animation,
     * so its host stays "visible" from its own point of view and owns the token,
     * while the workspace that is already mounted keeps publishing into a
     * rejection. Its ready re-assertion is a few frames, all spent inside the
     * exit, and the host dedupes whatever comes after — so when the overlay
     * finally unmounted and released, nothing was left to claim the view and the
     * AI panel came back blank.
     *
     * Releasing here, on the hide that the closing overlay now sends in its first
     * frame, frees the token before the workspace's attach can resolve. A host
     * that wants the view again simply publishes visible:true, which re-claims
     * it; the manager already compares rectangles, so a hidden-and-restored host
     * pays one message.
     */
    entry.hostToken = null
    entry.bounds = null
    entry.visible = false
    applyVisibility(entry)
    return true
  }

  if (!boundsEqual(entry.bounds, bounds)) {
    entry.bounds = bounds
    entry.view.setBounds(bounds)
  }

  entry.hostToken = hostToken
  entry.visible = true
  applyVisibility(entry)
  return true
}

/**
 * Applies the panel's corner radius to a native view.
 *
 * The AI panel rounds its content with CSS, and the main-process window used to
 * inherit that for free because a `<webview>` was a DOM element. A
 * `WebContentsView` is composited above the DOM instead, so without this it
 * paints square corners straight over the rounded frame.
 *
 * `View.setBorderRadius` is new in Electron 42 and is the only per-view rounding
 * API; `BrowserWindow.setShape` would clip the whole window, including the title
 * bar and the other panels. It takes an *integer*, so a fractional radius is
 * rejected by the argument converter before the call ever reaches the platform;
 * `parseBounds` rounds it at the trust boundary for that reason.
 *
 * Two things happen on failure, and both matter:
 *
 * - The value is *not* stored as applied, so the next geometry message retries
 *   it. Storing the request instead made a rejected call permanent.
 * - The warning is emitted once per rejected value. Geometry now arrives on
 *   every frame of a move, so a platform without the API would otherwise write a
 *   warning per frame for the whole session.
 */
function ensureBorderRadius(entry: ManagedAiView, radius: number): boolean {
  if (entry.appliedBorderRadius === radius) return true
  try {
    entry.view.setBorderRadius(radius)
    entry.appliedBorderRadius = radius
    entry.radiusFailureLogged = null
    return true
  } catch (error) {
    if (entry.radiusFailureLogged !== radius) {
      entry.radiusFailureLogged = radius
      Logger.warn('[AiView] setBorderRadius failed:', error)
    }
    return false
  }
}

/** Shows a view only when its current host has a usable visible rectangle. */

function applyVisibility(entry: ManagedAiView): void {
  const shouldShow = entry.visible && isUsableBounds(entry.bounds)
  if (shouldShow === entry.shown) return
  entry.view.setVisible(shouldShow)
  entry.shown = shouldShow

  // Throttle background activity: when hidden, mute audio to prevent hidden
  // provider views from keeping media pipeline / audio hardware clocks awake.
  if (!entry.webContents.isDestroyed()) {
    try {
      entry.webContents.setAudioMuted(!shouldShow)
    } catch {
      // Degrades gracefully if unavailable
    }
  }
}

export function getAiViewUrl(viewId: string): string | null {
  const entry = getManagedAiView(viewId)
  if (!entry) return null
  return liveUrlOf(entry)
}

export function reloadAiView(viewId: string): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  // An explicit reload supersedes any navigation whose load has not settled.
  entry.pendingNavigationEpoch += 1
  settlePendingNavigation(entry, entry.pendingNavigationEpoch)
  entry.webContents.reload()
  return true
}

/**
 * Renderer-initiated navigation into an existing view.
 *
 * Validated against the same partition policy the entry URL went through, so a
 * compromised renderer cannot use a managed `WebContents` (and its provider
 * session cookies) as a browser for an arbitrary https origin. Falling back to
 * the registry entry instead of loading would be worse than refusing: it would
 * silently discard the caller's intent, so an untrusted request is rejected.
 */
export function loadAiViewUrl(viewId: string, rawUrl: unknown): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  const url = typeof rawUrl === 'string' ? rawUrl : ''
  if (!isUrlTrustedForTarget(entry.target, url)) {
    Logger.warn('[AiView] Refused navigation outside the partition trusted origins:', {
      viewId,
      partition: entry.partition
    })
    return false
  }

  let normalized: string
  try {
    normalized = new URL(url).toString()
  } catch {
    return false
  }

  const now = Date.now()
  if (
    entry.pendingNavigationUrl === normalized &&
    now - entry.pendingNavigationStartedAt < PENDING_NAVIGATION_MAX_AGE_MS
  ) {
    // The same document is already on its way into this view. A second
    // `loadURL` would abort and restart the request, discarding the work the
    // first one has done (and any upload the site started from it).
    return true
  }

  entry.pendingNavigationUrl = normalized
  entry.pendingNavigationStartedAt = now
  const epoch = ++entry.pendingNavigationEpoch
  void entry.webContents.loadURL(normalized).then(
    () => settlePendingNavigation(entry, epoch),
    (error: unknown) => {
      settlePendingNavigation(entry, epoch)
      Logger.warn('[AiView] loadURL failed:', { viewId, error })
    }
  )
  return true
}

export function navigateAiView(viewId: string, delta: -1 | 1): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  if (delta === -1) entry.webContents.navigationHistory.goBack()
  else entry.webContents.navigationHistory.goForward()
  return true
}

export async function executeAiViewScript(viewId: string, script: string): Promise<unknown> {
  const entry = getManagedAiView(viewId)
  if (!entry) throw new Error('view_not_found')
  return entry.webContents.executeJavaScript(script, true)
}

export function insertAiViewText(viewId: string, text: string): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  entry.webContents.insertText(text)
  return true
}

type Modifier = NonNullable<Electron.KeyboardInputEvent['modifiers']>[number]

const MODIFIER_ALIASES: Readonly<Record<string, Modifier>> = {
  shift: 'shift',
  control: 'control',
  ctrl: 'ctrl',
  alt: 'alt',
  meta: 'meta',
  command: 'command',
  cmd: 'cmd'
}

/** Accepts only the modifier names `sendInputEvent` understands. */
function toElectronModifiers(modifiers: string[] | undefined): Modifier[] | undefined {
  if (!modifiers) return undefined
  const accepted = modifiers
    .map((modifier) => MODIFIER_ALIASES[modifier.toLowerCase()])
    .filter((modifier): modifier is Modifier => modifier !== undefined)
  return accepted.length > 0 ? accepted : undefined
}

export function sendAiViewInputEvent(viewId: string, inputEvent: AiContentInputEvent): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  const { type, keyCode } = inputEvent
  const modifiers = toElectronModifiers(inputEvent.modifiers)
  entry.webContents.sendInputEvent({
    type,
    keyCode,
    ...(modifiers ? { modifiers } : {})
  } as Electron.KeyboardInputEvent)
  return true
}

export function pasteAiView(viewId: string): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  entry.webContents.paste()
  return true
}

export function focusAiView(viewId: string): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  entry.webContents.focus()
  return true
}

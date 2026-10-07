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
import { getMainWindow } from '../../app/windowManager.js'
import { Logger } from '../../core/logger.js'
import { CHROME_USER_AGENT } from '../ai/aiManager.js'
import { boundsEqual, isUsableBounds, parseBounds, parseViewId } from './aiViewContract.js'
import { type AiViewLoadStateChange, bridgeWebContentsEvents } from './aiViewEventBridge.js'
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

export interface ManagedAiView {
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
  /** Token of the host placeholder currently allowed to move this view. */
  hostToken: string | null
  disposeBridge: () => void
}

const views = new Map<string, ManagedAiView>()
let generationCounter = 0

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

export function hasManagedAiView(viewId: string): boolean {
  return getManagedAiView(viewId) !== null
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
  const existing = getManagedAiView(viewId)
  if (existing && existing.sourceKey === sourceKey) {
    const window = getMainWindow()
    if (window && !window.isDestroyed()) {
      const children = (window.contentView as unknown as { children?: unknown[] })?.children
      if (Array.isArray(children) && !children.includes(existing.view)) {
        window.contentView.addChildView(existing.view)
      }
    }
    existing.hostToken = null
    return { ...snapshotOf(existing) }
  }
  if (existing) destroyEntry(viewId)

  const window = getMainWindow()
  if (!window || window.isDestroyed()) throw new Error('main_window_unavailable')

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
    hostToken: null,
    disposeBridge: () => {}
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

  views.set(viewId, entry)
  window.contentView.addChildView(view)
  view.setVisible(false)
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 })

  webContents.once('destroyed', () => {
    const current = views.get(viewId)
    if (current && current.generation === generation) views.delete(viewId)
  })

  void webContents.loadURL(entry.currentUrl).catch((error: unknown) => {
    Logger.warn('[AiView] Initial load failed:', { viewId, error })
  })

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

  entry.hostToken = null
  entry.visible = false
  entry.bounds = null
  applyVisibility(entry)
  return true
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

  if (!boundsEqual(entry.bounds, bounds)) {
    entry.bounds = bounds
    applyBorderRadius(entry.view, bounds.borderRadius ?? 0)
    entry.view.setBounds(bounds)
  }

  entry.hostToken = hostToken
  entry.visible = visible && isUsableBounds(bounds)
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
 * `View.setBorderRadius` is new in Electron 42 and is the only per-view
 * rounding API; `BrowserWindow.setShape` would clip the whole window, including
 * the title bar and the other panels. It is guarded because a platform that
 * lacks it should degrade to square corners rather than take the view down.
 */
function applyBorderRadius(view: WebContentsView, radius: number): void {
  try {
    view.setBorderRadius(radius)
  } catch (error) {
    Logger.warn('[AiView] setBorderRadius failed:', error)
  }
}

/** Shows a view only when its current host has a usable visible rectangle. */

function applyVisibility(entry: ManagedAiView): void {
  const shouldShow = entry.visible && isUsableBounds(entry.bounds)
  if (shouldShow === entry.shown) return
  entry.view.setVisible(shouldShow)
  entry.shown = shouldShow
}

export function getAiViewUrl(viewId: string): string | null {
  const entry = getManagedAiView(viewId)
  if (!entry) return null
  return liveUrlOf(entry)
}

export function reloadAiView(viewId: string): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
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
  void entry.webContents.loadURL(url).catch((error: unknown) => {
    Logger.warn('[AiView] loadURL failed:', { viewId, error })
  })
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

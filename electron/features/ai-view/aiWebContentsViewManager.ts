import type { WebContents } from 'electron'
import { WebContentsView } from 'electron'

import type {
  AiContentInputEvent,
  AiViewAttachRequest,
  AiViewAttachResponse,
  AiViewBounds,
  AiViewEvent,
  AiViewSource
} from '../../../shared/types/aiView.js'
import { applyRemoteContentSecurity } from '../../app/window/remoteContentSecurity.js'
import { getMainWindow } from '../../app/windowManager.js'
import { Logger } from '../../core/logger.js'
import { CHROME_USER_AGENT } from '../ai/aiManager.js'
import { boundsEqual, isUsableBounds, parseBounds, parseViewId } from './aiViewContract.js'
import { bridgeWebContentsEvents } from './aiViewEventBridge.js'
import { resolveAiViewTarget, resolveEntryUrl } from './aiViewTargets.js'

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
  /** Registry id / app id this view was resolved from; `null` once retired. */
  sourceKey: string
  partition: string
  currentUrl: string
  generation: number
  visible: boolean
  /** What `setVisible` was last called with, so repeat calls are skipped. */
  shown: boolean
  bounds: AiViewBounds | null
  /** Token of the host placeholder currently allowed to move this view. */
  hostToken: string | null
  /** Whether mouse input is currently forwarded to the app instead of the page. */
  ignoreMouse: boolean
  disposeBridge: () => void
}

const views = new Map<string, ManagedAiView>()
let generationCounter = 0
let mouseForwardingRequests = 0
let windowMouseForwardingApplied = false

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

export async function attachAiView(request: AiViewAttachRequest): Promise<AiViewAttachResponse> {
  const viewId = parseViewId(request?.viewId)
  if (!viewId) throw new Error('invalid_view_id')

  const target = await resolveAiViewTarget(request.source)
  if (!target) throw new Error('unknown_view_target')

  const sourceKey = sourceKeyOf(request.source)
  const existing = getManagedAiView(viewId)
  if (existing && existing.sourceKey === sourceKey) {
    return { generation: existing.generation, currentUrl: existing.currentUrl, created: false }
  }
  if (existing) destroyAiView(viewId)

  const window = getMainWindow()
  if (!window || window.isDestroyed()) throw new Error('main_window_unavailable')

  // A fresh view must not inherit a stale forward request from a destroyed one.
  mouseForwardingRequests = 0
  windowMouseForwardingApplied = false

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
    partition: target.partition,
    currentUrl: resolveEntryUrl(target, request.restoredUrl ?? null),
    generation,
    visible: false,
    shown: false,
    bounds: null,
    hostToken: null,
    ignoreMouse: false,
    disposeBridge: () => {}
  }

  const disposeBridge = bridgeWebContentsEvents({
    viewId,
    generation,
    webContents,
    emit
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

  return { generation, currentUrl: entry.currentUrl, created: true }
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
  entry.ignoreMouse = false
  applyVisibility(entry)
  recomputeMouseForwardingRequests()
  return true
}

export function destroyAiView(viewId: string): boolean {
  const entry = views.get(viewId)
  if (!entry) return false
  views.delete(viewId)
  recomputeMouseForwardingRequests()

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
    entry.webContents.close()
  }

  return true
}

export function destroyAllAiViews(): void {
  for (const viewId of views.keys()) destroyAiView(viewId)
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
    entry.view.setBounds(bounds)
  }

  entry.hostToken = hostToken
  entry.visible = visible && isUsableBounds(bounds)
  applyVisibility(entry)
  return true
}

/**
 * Routes mouse input to the app while the bottom bar owns the pointer.
 *
 * A `WebContentsView` is composited above the whole DOM tree, so a transparent
 * overlay can no longer shield it from the resizer dock the way it shielded a
 * `<webview>`. `setIgnoreMouseEvents` only exists on the window in Electron 42,
 * so the request is applied there with `forward: true`: the dock keeps receiving
 * hover and drag events, and the embedded site stops stealing pointer input for
 * exactly as long as the app asks for it.
 */
export function setAiViewIgnoreMouse(viewId: string, hostToken: string, ignore: boolean): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  if (entry.hostToken !== null && entry.hostToken !== hostToken) return false
  if (entry.ignoreMouse === ignore) return true

  entry.ignoreMouse = ignore
  recomputeMouseForwardingRequests()
  return true
}

function applyWindowMouseMode(): void {
  const next = mouseForwardingRequests > 0
  if (next === windowMouseForwardingApplied) return

  const window = getMainWindow()
  if (!window || window.isDestroyed()) return

  windowMouseForwardingApplied = next
  try {
    window.setIgnoreMouseEvents(next, { forward: true })
  } catch (error) {
    Logger.warn('[AiView] setIgnoreMouseEvents failed:', error)
  }
}

function recomputeMouseForwardingRequests(): void {
  const next = [...views.values()].filter((entry) => entry.ignoreMouse).length
  if (next === mouseForwardingRequests) return
  mouseForwardingRequests = next
  applyWindowMouseMode()
}

function applyVisibility(entry: ManagedAiView): void {
  const shouldShow = entry.visible && isUsableBounds(entry.bounds)
  if (shouldShow === entry.shown) return
  entry.view.setVisible(shouldShow)
  entry.shown = shouldShow
}

export function getAiViewUrl(viewId: string): string | null {
  const entry = getManagedAiView(viewId)
  if (!entry) return null
  try {
    return entry.webContents.getURL() || entry.currentUrl
  } catch {
    return entry.currentUrl
  }
}

export function reloadAiView(viewId: string): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  entry.webContents.reload()
  return true
}

export function loadAiViewUrl(viewId: string, rawUrl: unknown): boolean {
  const entry = getManagedAiView(viewId)
  if (!entry) return false
  const url = typeof rawUrl === 'string' ? rawUrl : ''
  if (!url) return false
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

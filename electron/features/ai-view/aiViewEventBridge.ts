import type { WebContents } from 'electron'

import type { AiViewEvent } from '../../../shared/types/aiView.js'

/**
 * Translates `WebContents` lifecycle events into the typed payload the
 * renderer controller consumes.
 *
 * The renderer used to receive these as `<webview>` DOM events; they now
 * arrive over a single IPC event channel. Each payload carries the generation
 * of the view that produced it so a destroyed view can never write state into
 * its replacement.
 */

const NON_CRASH_REASONS = new Set(['clean-exit', 'killed'])

export function isCrashReason(reason: string): boolean {
  return !NON_CRASH_REASONS.has(reason)
}

interface ConsoleMessagePayload {
  level: string
  message: string
  lineNumber: number
  sourceId: string
}

/**
 * Electron exposes console output both on the event object and as positional
 * arguments. Read the object form first and fall back to the legacy tuple so a
 * guest console message (which is how the Magic Selector reports its result)
 * is never dropped.
 */
export function normalizeConsoleMessage(
  event: unknown,
  legacy: { level?: unknown; message?: unknown; lineNumber?: unknown; sourceId?: unknown } = {}
): ConsoleMessagePayload {
  const source = (event ?? {}) as Record<string, unknown>
  const readString = (value: unknown): string => (typeof value === 'string' ? value : '')
  const readNumber = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0

  return {
    level: readString(source.level) || readString(legacy.level),
    message: readString(source.message) || readString(legacy.message),
    lineNumber: readNumber(source.lineNumber) || readNumber(legacy.lineNumber),
    sourceId: readString(source.sourceId) || readString(legacy.sourceId)
  }
}

export interface AiViewEventBridgeContext {
  viewId: string
  generation: number
  webContents: WebContents
  emit: (event: AiViewEvent) => void
}

export function bridgeWebContentsEvents(context: AiViewEventBridgeContext): () => void {
  const { viewId, generation, webContents, emit } = context
  const base = { viewId, generation }
  const currentUrl = (): string => {
    try {
      return webContents.isDestroyed() ? '' : webContents.getURL()
    } catch {
      return ''
    }
  }

  const onDidStartLoading = () =>
    emit({ ...base, kind: 'did-start-loading', currentUrl: currentUrl() })

  const onDomReady = () => {
    applyPageChrome(webContents)
    emit({ ...base, kind: 'dom-ready', currentUrl: currentUrl() })
  }

  const onDidStopLoading = () =>
    emit({ ...base, kind: 'did-stop-loading', currentUrl: currentUrl() })

  const onDidFailLoad = (
    _event: Electron.Event,
    errorCode: number,
    errorDescription: string,
    validatedURL: string,
    isMainFrame: boolean
  ) => {
    if (!isMainFrame) return
    emit({
      ...base,
      kind: 'did-fail-load',
      errorCode,
      errorDescription,
      currentUrl: validatedURL || currentUrl()
    })
  }

  // Electron 42's `did-navigate` no longer carries `isMainFrame`; it is the
  // main-frame navigation event (`did-frame-navigate` covers child frames and is
  // deliberately not bridged, so SPA traffic inside an iframe cannot be mistaken
  // for the panel's own document).
  const onDidNavigate = (
    _event: Electron.Event,
    url: string,
    _httpResponseCode: number,
    _httpStatusText: string
  ) => {
    emit({ ...base, kind: 'did-navigate', url, isMainFrame: true })
  }

  const onDidNavigateInPage = (
    _event: Electron.Event,
    url: string,
    isMainFrame: boolean,
    _frameProcessId: number,
    _frameRoutingId: number
  ) => {
    if (!isMainFrame) return
    emit({ ...base, kind: 'did-navigate-in-page', url, isMainFrame })
  }

  const onRenderProcessGone = (
    _event: Electron.Event,
    details: Electron.RenderProcessGoneDetails
  ) => {
    const reason = details?.reason ?? ''
    if (!isCrashReason(reason)) return
    emit({
      ...base,
      kind: 'render-process-gone',
      reason,
      exitCode: details?.exitCode ?? 0
    })
  }

  const onConsoleMessage = (
    event: unknown,
    level?: unknown,
    message?: unknown,
    lineNumber?: unknown,
    sourceId?: unknown
  ) => {
    emit({
      ...base,
      kind: 'console-message',
      ...normalizeConsoleMessage(event, { level, message, lineNumber, sourceId })
    })
  }

  webContents.on('did-start-loading', onDidStartLoading)
  webContents.on('did-stop-loading', onDidStopLoading)
  webContents.on('dom-ready', onDomReady)
  webContents.on('did-fail-load', onDidFailLoad)
  webContents.on('did-navigate', onDidNavigate)
  webContents.on('did-navigate-in-page', onDidNavigateInPage)
  webContents.on('render-process-gone', onRenderProcessGone)
  webContents.on('console-message', onConsoleMessage)

  return () => {
    if (webContents.isDestroyed()) return
    webContents.removeListener('did-start-loading', onDidStartLoading)
    webContents.removeListener('did-stop-loading', onDidStopLoading)
    webContents.removeListener('dom-ready', onDomReady)
    webContents.removeListener('did-fail-load', onDidFailLoad)
    webContents.removeListener('did-navigate', onDidNavigate)
    webContents.removeListener('did-navigate-in-page', onDidNavigateInPage)
    webContents.removeListener('render-process-gone', onRenderProcessGone)
    webContents.removeListener('console-message', onConsoleMessage)
  }
}

/**
 * Replaces the default opaque Chromium scrollbars with the thin translucent
 * variant the embedded panels use. Done in the main process because a
 * `WebContentsView` has no renderer-side element to inject into.
 */
const PAGE_CHROME_CSS = `
  html, body {
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.28) rgba(255,255,255,0.08);
  }

  *::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  *::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.08);
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  *::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.18));
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  *::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(255,255,255,0.46), rgba(255,255,255,0.24));
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  *::-webkit-scrollbar-corner {
    background: transparent;
  }
`

const pageChromeApplied = new WeakSet<WebContents>()

function applyPageChrome(webContents: WebContents): void {
  if (pageChromeApplied.has(webContents)) return
  pageChromeApplied.add(webContents)
  void webContents.insertCSS(PAGE_CHROME_CSS).catch(() => {
    // Cosmetic only; a rejected injection is not worth surfacing.
  })
}

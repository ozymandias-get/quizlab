/**
 * Wire contract between the renderer host placeholders and the main-process
 * `AiWebContentsViewManager`.
 *
 * The renderer never names a partition, a `WebContents` or a `webContentsId`.
 * It names a *view id* it minted itself (an AI tab id, or a namespaced pdf-tab
 * id) and a *source* descriptor that the main process resolves against its own
 * registry. Everything else — partition, entry URL, user agent, the actual
 * `WebContents` — is manager-owned state.
 */

export interface AiViewBounds {
  x: number
  y: number
  width: number
  height: number
  /**
   * Corner radius in device-independent pixels.
   *
   * A native view is composited above the DOM, so it cannot inherit the panel's
   * `border-radius` the way a `<webview>` element did — without this it paints
   * square corners straight over the rounded panel frame. Optional so that a
   * caller that does not care gets square corners; the main process defaults it
   * to 0 and the host hook always sends the measured value.
   */
  borderRadius?: number
}

export type AiContentInputEventType = 'keyDown' | 'keyUp' | 'char'

/** Mirrors the subset of `Electron.InputEvent` the paste fallback needs. */
export interface AiContentInputEvent {
  type: AiContentInputEventType
  keyCode: string
  modifiers?: string[]
}

export type AiViewEventKind =
  | 'state'
  | 'did-start-loading'
  | 'did-stop-loading'
  | 'dom-ready'
  | 'did-fail-load'
  | 'did-navigate'
  | 'did-navigate-in-page'
  | 'render-process-gone'
  | 'console-message'

/**
 * The one description of a managed view's state.
 *
 * A `WebContentsView` outlives every React host that positions it, so a host
 * mounting onto an existing view (a focus-mode handoff, a tab coming back from
 * behind an overlay) has no way to learn what already happened to it: the events
 * that reported it were delivered to whoever held the view at the time, and a
 * load that finished long ago emits nothing at all. Without a snapshot such a
 * host waits forever for a `did-stop-loading` that will never come again.
 *
 * The manager therefore recomputes this from the `WebContents` it owns and
 * hands it to every new host — on the attach response and, for a host that is
 * already mounted, as a `state` event. It is the same value either way, so the
 * renderer has one bootstrap path instead of two.
 */
export interface AiViewStateSnapshot {
  generation: number
  /** Last known URL of the guest, refreshed on every navigation. */
  currentUrl: string
  isLoading: boolean
  /**
   * True once the first load *attempt* settled, successfully or not.
   *
   * Hosts that reveal the native view only after its first paint key off this,
   * so a view whose load failed fatally still counts as settled: what should be
   * displayed then is the error, not an endless splash.
   */
  hasLoadedOnce: boolean
  /** Last main-frame load failure, or `null` when the last attempt produced a document. */
  error: { code: number; description: string } | null
}

interface AiViewEventBase {
  viewId: string
  /**
   * Monotonic id of the concrete `WebContentsView` this event came from.
   * The renderer drops any event whose generation no longer matches the one it
   * received at attach time, so a destroyed view can never resurrect state in
   * its replacement.
   */
  generation: number
}

export type AiViewEvent = AiViewEventBase &
  (
    | ({ kind: 'state' } & AiViewStateSnapshot)
    | { kind: 'did-start-loading'; currentUrl: string }
    | { kind: 'did-stop-loading'; currentUrl: string }
    | { kind: 'dom-ready'; currentUrl: string }
    | {
        kind: 'did-fail-load'
        errorCode: number
        errorDescription: string
        currentUrl: string
      }
    | { kind: 'did-navigate'; url: string; isMainFrame: boolean }
    | { kind: 'did-navigate-in-page'; url: string; isMainFrame: boolean }
    | { kind: 'render-process-gone'; reason: string; exitCode: number }
    | {
        kind: 'console-message'
        level: string
        message: string
        lineNumber: number
        sourceId: string
      }
  )

export type AiViewEventOf<K extends AiViewEventKind> = Extract<AiViewEvent, { kind: K }>

/**
 * Identifies what a managed view is allowed to display. Deliberately a closed
 * union of *main-process known* keys: the renderer can pick a target but cannot
 * mint a partition or an origin.
 */
export type AiViewSource =
  | { kind: 'ai-platform'; modelId: string }
  | { kind: 'google-web-app'; appId: string }

export interface AiViewAttachRequest {
  viewId: string
  source: AiViewSource
  /**
   * Last known URL of this view, replayed after a cold unmount / sleep. The
   * manager only honours it when it is https and its host is trusted for the
   * resolved partition; otherwise it falls back to the registry entry URL.
   */
  restoredUrl?: string
}

export type AiViewAttachResponse = AiViewStateSnapshot

export interface AiViewHostRequest {
  viewId: string
  hostToken: string
}

/**
 * Atomic geometry + visibility update from a host placeholder.
 *
 * Bounds and visibility travel together so a single writer owns both: during a
 * focus-mode handoff two hosts can briefly exist for the same view, and only the
 * active surface sends this message, so a stale host can never overwrite the
 * active one. `hostToken` additionally lets the manager reject any late message
 * from a host that has already been superseded.
 */
export interface AiViewHostSyncRequest extends AiViewHostRequest {
  bounds: AiViewBounds
  visible: boolean
}

export interface AiViewTabRequest {
  viewId: string
}

export interface AiViewNavigateRequest extends AiViewTabRequest {
  delta: -1 | 1
}

export interface AiViewLoadUrlRequest extends AiViewTabRequest {
  url: string
}

export interface AiViewScriptRequest extends AiViewTabRequest {
  script: string
}

export interface AiViewTextRequest extends AiViewTabRequest {
  text: string
}

export interface AiViewInputEventRequest extends AiViewTabRequest {
  inputEvent: AiContentInputEvent
}

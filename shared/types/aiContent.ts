import type { AiContentInputEvent, AiViewEventKind, AiViewEventOf } from './aiView.js'

export type { AiContentInputEvent }

/**
 * Renderer-side handle for one main-process-owned remote content surface.
 *
 * The implementation is backed by a `WebContentsView` in the main process and
 * reaches it over typed IPC keyed by a renderer-minted view id. Nothing here
 * touches the DOM, so the controller has the same behaviour no matter which
 * React host placeholder currently owns it (normal workspace, focus overlay,
 * pdf panel).
 *
 * Every method is optional except `executeJavaScript` so that a partially
 * initialised controller (attach still in flight) degrades instead of throwing,
 * mirroring how the previous `<webview>`-backed controller behaved while the
 * guest element was being mounted.
 */
export interface AiContentController {
  executeJavaScript(script: string): Promise<unknown>
  loadURL?(url: string): Promise<unknown>
  insertText?(text: string): Promise<unknown>
  reload?(): Promise<unknown>
  goBack?(): Promise<unknown>
  goForward?(): Promise<unknown>
  /** Last URL reported by the main process; `undefined` until the first navigation. */
  getURL?(): string | undefined
  sendInputEvent?(inputEvent: AiContentInputEvent): Promise<unknown>
  /** Native `webContents.paste()` into the managed view. */
  paste?(): Promise<boolean>
  focus?(): Promise<unknown>
  isDestroyed?(): boolean
  isLoading?(): boolean
  /** True once the main process confirmed the managed view exists for this id. */
  isReady?(): boolean
  subscribeEvent?<K extends AiViewEventKind>(
    kind: K,
    handler: (event: AiViewEventOf<K>) => void
  ): () => void
  /** Notified when the managed view becomes available / goes away. */
  subscribeReady?(listener: (ready: boolean) => void): () => void
}

/** Content controller reference used by picker and messaging hooks (nullable when no tab). */
export type AiContentRef = AiContentController | null

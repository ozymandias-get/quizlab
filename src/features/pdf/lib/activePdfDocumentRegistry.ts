/**
 * Active capture-document registry — the mounted viewer's document, offered to
 * capture so a high-DPI page render reuses it instead of re-downloading and
 * re-decoding a large file.
 *
 * The registry was previously lived under the OCR feature; it moved here because
 * the PDF viewer and the capture pipeline rely on it independently.
 *
 * ## What it owns — and what it does not
 *
 * | Concern        | Owner                                       |
 * | -------------- | ------------------------------------------- |
 * | lookup         | this module                                  |
 * | identity       | this module (`pdfUrl` + the registrant's id) |
 * | liveness       | this module, **asking the handle**           |
 * | document load  | the viewer (`PdfDocumentManager`)            |
 * | teardown       | the viewer                                   |
 *
 * Capture **borrows**; it never destroys. A borrowed document belongs to a
 * mounted viewer, and tearing it down drops that viewer's shared decoded-object
 * cache (`objs.clear()`), forcing a font/image re-decode on its next repaint.
 * The registry therefore has no `destroy()` anywhere in its surface: there is no
 * way for a reader to end a document's life by accident.
 *
 * ## Why the stored value is a handle, not a document proxy
 *
 * A PDF.js `PDFDocumentProxy` declares `destroyed?: boolean` and `destroy()`, which
 * would have let the registry read liveness straight off the proxy. The pinned
 * 6.4.299 has neither — `PDFDocumentProxy` exposes only `cleanup()`, and
 * teardown goes through `PDFDocumentLoadingTask.destroy()`. Reading `destroyed`
 * anyway would be a lie with a runtime cost: a field 6.x never sets reads
 * `undefined`, so a reloaded document would look alive forever.
 *
 * So the stored value is `ActivePdfDocumentHandle`: the smallest surface capture
 * uses (`getPage`) plus an **adapter-provided** `isAlive()`. Nothing in this file
 * knows what a `PDFDocumentProxy` is or how its lifetime is managed — that is
 * `engine/captureDocument.ts`'s job, reached from
 * `native/useNativePdfCaptureDocument.ts`, the only producer.
 * There is deliberately no runtime branch here and there must never be one: a
 * version check in the store would be a second place to update whenever the
 * runtime changes.
 *
 * ## Why the liveness check exists at all
 *
 * A viewer "Reload" remounts the document without unmounting the owning
 * component, so the previous proxy is dead while the URL is unchanged. With a
 * URL-only match the registry kept handing out that dead proxy; `getPage()` then
 * rejected and the capture silently degraded to a screen-resolution canvas clone
 * — a wrong-looking image with no error anywhere. A dead entry is now evicted on
 * sight, so the next capture self-loads instead.
 *
 * ## Multiple viewer instances
 *
 * QuizLab can have two `PdfViewer` trees mounted at once (`LeftPanel` and the
 * `FocusOverlay`), and both may be showing the same file. The store is a single
 * slot, so **the most recent registration wins** — the pre-existing semantics,
 * deliberately not "the visible one wins", which would need a visibility signal
 * this registry has no business reading. Deregistration is token-scoped: an
 * unmounting viewer only clears the slot when the entry is still its own, so a
 * viewer going away cannot evict a live sibling's document.
 */

/** The part of a page's viewport the pixel budget needs. */
interface CapturePageViewport {
  width: number
  height: number
}

/** PDF.js's render handle. `cancel` is never called on a borrowed page. */
interface CaptureRenderTask {
  promise: Promise<void>
  cancel?: () => void
}

/**
 * One page, narrowed to what a direct capture render touches.
 *
 * Deliberately structural: capture only ever passes a viewport it just received
 * back to the same page, so `getViewport` / `render` is the whole contract.
 */
export interface CaptureDocumentPage {
  getViewport(options: { scale: number }): CapturePageViewport
  render(options: {
    canvasContext: CanvasRenderingContext2D
    viewport: CapturePageViewport
  }): CaptureRenderTask
}

/**
 * A borrowed document, as capture sees it.
 *
 * Produced by the runtime adapter. `isAlive()` must answer "can `getPage()` still
 * work?", and must keep answering `false` once it cannot — it is the only thing
 * standing between a reload and a silently degraded screenshot.
 */
export interface ActivePdfDocumentHandle {
  getPage(pageNumber: number): Promise<CaptureDocumentPage>
  isAlive(): boolean
}

/**
 * Opaque receipt for one registration, so a deregistration can be scoped to the
 * registrant that made it.
 *
 * Obtained from `setActivePdfDocument`; pass it back to `clearActivePdfDocument`.
 * Two tokens are never equal, including across a re-registration of the same
 * document.
 */
export type ActivePdfDocumentToken = symbol

interface ActivePdfDocumentEntry {
  pdfUrl: string
  /** The registrant's own name for the document; the registry infers nothing. */
  identity: string | null
  handle: ActivePdfDocumentHandle
  token: ActivePdfDocumentToken
}

/** The single slot. See the module note for the multi-viewer semantics. */
let activeEntry: ActivePdfDocumentEntry | null = null

/**
 * Register the mounted document capture should borrow.
 *
 * A `null` document clears the slot, which is what a viewer does while its
 * document identity is changing.
 */
export function setActivePdfDocument(
  handle: ActivePdfDocumentHandle | null,
  pdfUrl: string | null,
  identity?: string | null
): ActivePdfDocumentToken | null {
  if (!handle || !pdfUrl) {
    activeEntry = null
    return null
  }

  activeEntry = {
    pdfUrl,
    identity: identity ?? null,
    handle,
    token: Symbol('active-pdf-document')
  }
  return activeEntry.token
}

/**
 * Drop the registration.
 *
 * With a `token`, only the entry that produced it is dropped — the unmount path
 * for one of two mounted viewers. Without one, the slot is emptied
 * unconditionally.
 */
export function clearActivePdfDocument(token?: ActivePdfDocumentToken | null): void {
  if (token === undefined || token === null) {
    activeEntry = null
    return
  }
  if (activeEntry?.token === token) activeEntry = null
}

/**
 * The registered document for `pdfUrl`, or `null`.
 *
 * `null` means "caller must load its own": nothing is registered, the URL
 * differs, or the registered handle reported itself dead (in which case the stale
 * entry is evicted here so no later capture retries it).
 */
export function getActivePdfDocument(pdfUrl: string): ActivePdfDocumentHandle | null {
  const current = activeEntry
  if (!current || current.pdfUrl !== pdfUrl) return null

  let alive: boolean
  try {
    alive = current.handle.isAlive()
  } catch {
    // A throwing probe is indistinguishable from a dead document, and treating it
    // as alive would hand capture a proxy it cannot use.
    alive = false
  }

  if (!alive) {
    if (activeEntry === current) activeEntry = null
    return null
  }

  return current.handle
}

/**
 * The identity string the current entry was registered with, or `null`.
 *
 * Diagnostics and the reload-generation tests: it is the registrant's own name
 * for the document, so the registry compares nothing and infers nothing from it.
 */
export function getActivePdfDocumentIdentity(): string | null {
  return activeEntry?.identity ?? null
}

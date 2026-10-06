/**
 * The `pdfjs-dist@3.11.174` adapter for the capture-document registry.
 *
 * ## Why this file exists
 *
 * `activePdfDocumentRegistry` stores a runtime-agnostic
 * {@link ActivePdfDocumentHandle}. Producing one for the legacy viewer means
 * answering two questions PDF.js 6 no longer has:
 *
 *  1. **Is the proxy still usable?** 3.x sets `PDFDocumentProxy#destroyed` when
 *     its loading task is torn down. 6.x removed the flag entirely (teardown is
 *     `PDFDocumentLoadingTask#destroy()` and the proxy only offers `cleanup()`),
 *     which is why the native side answers through its `PdfDocumentManager`
 *     instead. The knowledge belongs here, next to the version it describes, not
 *     in the store.
 *  2. **What does a page look like to capture?** Structurally the same on both
 *     runtimes, but each proxy has its own `PageViewport` type, so each adapter
 *     maps its own page.
 *
 * ## Why it is reachable from `setActivePdfDocument`
 *
 * `ui/components/PdfViewerElement.tsx` hands over `DocumentLoadEvent#doc`
 * verbatim and is frozen at zero diff for the whole of Phase 8A, so the registry
 * cannot demand a handle at that call site. `toCaptureHandle` is the one
 * structural test — "does it bring its own liveness probe?" — that keeps the raw
 * proxy working while every other registrant passes a real handle.
 *
 * ## Remove with the dual runtime (Phase 8B)
 *
 * Deleted together with `PdfViewerElement.tsx`, and then `setActivePdfDocument`
 * takes handles only. Nothing else in the tree refers to the 3.x `destroyed`
 * flag.
 */
import type { PageViewport, PDFDocumentProxy } from 'pdfjs-dist'

import type { ActivePdfDocumentHandle, CaptureDocumentPage } from './activePdfDocumentRegistry'

/**
 * True when `candidate` is already a capture handle.
 *
 * A structural test on one method, not a version test: the native handle answers
 * `isAlive()` from its document manager, and the 3.x proxy does not have the
 * method at all.
 */
function isCaptureHandle(candidate: unknown): candidate is ActivePdfDocumentHandle {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof (candidate as ActivePdfDocumentHandle).isAlive === 'function'
  )
}

/** Narrow a 3.x page proxy to the capture page surface. */
function toCapturePage(
  page: Awaited<ReturnType<PDFDocumentProxy['getPage']>>
): CaptureDocumentPage {
  return {
    getViewport: ({ scale }) => page.getViewport({ scale }),
    render: ({ canvasContext, viewport }) =>
      // The viewport is always the object this page's own `getViewport` produced
      // — capture measures a page and renders the measurement straight back — so
      // the assertion only recovers that identity across the runtime-agnostic
      // boundary. It is a `PageViewport` at runtime; the two runtimes simply
      // declare it in different packages.
      page.render({ canvasContext, viewport: viewport as PageViewport })
  }
}

/**
 * Wrap a legacy `@react-pdf-viewer` document proxy as a capture handle.
 *
 * The returned handle borrows: it exposes `getPage` and a liveness probe and
 * nothing else, so no capture path can reach `destroy()` on the viewer's proxy.
 */
export function createLegacyCaptureHandle(document: PDFDocumentProxy): ActivePdfDocumentHandle {
  return {
    getPage: async (pageNumber: number) => toCapturePage(await document.getPage(pageNumber)),
    // 3.x's own flag. Read through a widened local type because the published
    // `PDFDocumentProxy` declaration marks the property `boolean`, while pdf.js
    // only ever assigns `true` — `destroyed === true` is the test that must hold.
    isAlive: () => (document as unknown as { destroyed?: boolean }).destroyed !== true
  }
}

/**
 * Accept either a real capture handle or a raw 3.x proxy and return a handle.
 *
 * Handles pass through untouched, so the native adapter's `isAlive()` — and any
 * future one — is exactly the function the registry will call.
 */
export function toCaptureHandle(candidate: ActivePdfDocumentHandle): ActivePdfDocumentHandle
export function toCaptureHandle(candidate: PDFDocumentProxy): ActivePdfDocumentHandle
export function toCaptureHandle(
  candidate: ActivePdfDocumentHandle | PDFDocumentProxy
): ActivePdfDocumentHandle {
  return isCaptureHandle(candidate)
    ? candidate
    : createLegacyCaptureHandle(candidate as PDFDocumentProxy)
}

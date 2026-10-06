/**
 * The `pdfjs-6` adapter for the capture-document registry, plus the isolated
 * temporary load capture falls back to when nothing is mounted.
 *
 * ## Two producers, one contract
 *
 * | Producer             | Handle lives as long as                       | `isAlive()` answers                          |
 * | -------------------- | --------------------------------------------- | ------------------------------------------- |
 * | mounted viewer       | the viewer's `PdfDocumentManager`            | `!manager.destroyed && manager.getDocument() === document` |
 * | temporary capture    | a throwaway `PdfDocumentManager` this call owns | `!manager.destroyed && manager.getDocument() !== null` |
 *
 * Both are the same object shape, and both are reached through the engine, so
 * `renderPageToImage.ts` needs no idea which one it borrowed.
 *
 * ## Why liveness is the manager's, not the proxy's
 *
 * PDF.js 6 removed `PDFDocumentProxy#destroyed` and `#destroy()`: teardown is
 * `PDFDocumentLoadingTask#destroy()`, which the engine owns. So "is this document
 * still usable?" is answered by asking the manager whether *it* still holds that
 * document — which is exactly false in the three windows that matter, without
 * reaching for a version-specific flag:
 *
 *  - **reload** — `load()` disposes the previous task before starting the new one,
 *    so the old proxy is unreachable from the moment the reload begins
 *  - **document switch** — same mechanism, same instant
 *  - **unmount / disable** — `manager.destroy()` clears the active document and
 *    marks the manager destroyed
 *
 * ## Ownership
 *
 * A temporary document is loaded through a **fresh** `PdfDocumentManager`, and
 * `release()` calls `manager.destroy()` — the same single teardown call the
 * native viewer uses, which reaches `PDFDocumentLoadingTask#destroy()`, aborts
 * the worker-side work with it, and is preceded by the worker's own
 * `initializeNativePdfWorker()` bootstrap inside `load()`. Nothing else is
 * needed: no page `cleanup()`, no document `destroy()`, because the loading task
 * owns all of it.
 *
 * A borrowed handle from a mounted viewer has no `release()` at all. Capture
 * cannot end that document's life even by accident, which is the invariant the
 * whole registry contract exists to protect.
 *
 * ## Why this lives in the native boundary rather than in `lib/`
 *
 * Only `features/pdf/native/**` (and `NativePdfViewer.tsx`) may import
 * `@features/pdf/engine`, and the engine is the only place that may import
 * `pdfjs-6`. `lib/renderPageToImage.ts` needs a pdfjs-6 document load, so the
 * capability is published here and borrowed from there.
 *
 * > **TEMPORARY BRIDGE.** That import direction — the legacy capture module
 * > reaching into the native boundary for its fallback load — exists only while
 * > both runtimes ship. Phase 8B deletes `pdfjs-dist@3`, `renderPageToImage`'s
 * > legacy branch and this indirection together.
 */
import type { PdfDocumentManager } from '@features/pdf/engine'
import { createPdfDocumentManager } from '@features/pdf/engine'
import type {
  ActivePdfDocumentHandle,
  CaptureDocumentPage
} from '@features/pdf/lib/activePdfDocumentRegistry'

import type { PageViewport, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-6'

/** Narrow a pdfjs-6 page proxy to the capture page surface. */
function toCapturePage(page: PDFPageProxy): CaptureDocumentPage {
  return {
    getViewport: ({ scale }) => page.getViewport({ scale }),
    render: ({ canvasContext, viewport }) =>
      // Capture measures a page with `getViewport` and renders that same
      // measurement straight back, so the value really is this page's own
      // `PageViewport`; the assertion only recovers the identity that the
      // runtime-agnostic boundary erases. Same shape as the legacy adapter's.
      //
      // `canvas` is passed alongside `canvasContext` because 6.x deprecates the
      // context in favour of the element, and deriving it explicitly keeps the
      // call identical whether or not PDF.js is asked to do it for us.
      page.render({
        canvasContext,
        canvas: canvasContext.canvas,
        viewport: viewport as PageViewport
      })
  }
}

/**
 * A capture handle over a document this manager owns.
 *
 * `getPage` goes through the manager's page cache rather than the proxy, so a
 * capture of the visible page reuses the very `PDFPageProxy` the canvas and the
 * text layer already hold — no second decode, and no page proxy for capture to
 * leak.
 */
function createHandle(
  manager: PdfDocumentManager,
  ownsDocument: (document: PDFDocumentProxy) => boolean
): ActivePdfDocumentHandle {
  return {
    getPage: async (pageNumber: number) => toCapturePage(await manager.getPage(pageNumber)),
    isAlive: () => {
      if (manager.destroyed) return false
      const document = manager.getDocument()
      return document !== null && ownsDocument(document)
    }
  }
}

/**
 * The mounted native viewer's document, as a capture handle.
 *
 * Registered by `useNativePdfCaptureDocument` once the document is ready.
 */
export function createNativeCaptureHandle(
  manager: PdfDocumentManager,
  document: PDFDocumentProxy
): ActivePdfDocumentHandle {
  return createHandle(manager, (active) => active === document)
}

export interface TemporaryCaptureDocument {
  handle: ActivePdfDocumentHandle
  /**
   * Tear the document down. Idempotent, and required: a temporary document owns
   * a `PDFLoadingTask`, so skipping this leaks the worker-side resources for as
   * long as the app runs.
   */
  release(): void
}

/**
 * Load an isolated document purely for one capture.
 *
 * Used when the registry has nothing to lend: the viewer is not mounted, has not
 * finished loading, is showing a different file, or has been torn down. Same
 * `getDocument` options, same worker, same security posture as the viewer's own
 * load — `createPdfDocumentManager` is what guarantees that, which is why this
 * does not call `getDocument` directly.
 */
export async function loadTemporaryCaptureDocument(url: string): Promise<TemporaryCaptureDocument> {
  const manager = createPdfDocumentManager()
  const document = await manager.load(url)
  if (!document) {
    // Only reachable if something destroyed the manager between the two calls,
    // which cannot happen for a local instance — but leaving a loading task
    // behind would be a leak, so the failure path still tears it down.
    manager.destroy()
    throw new Error('Capture document load was superseded before it resolved')
  }

  return {
    handle: createHandle(manager, () => true),
    release: () => manager.destroy()
  }
}

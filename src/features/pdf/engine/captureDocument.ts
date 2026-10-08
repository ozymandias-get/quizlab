/**
 * The capture-document adapter: the engine's public surface for "give me a
 * document to render a page from, and tell me whether it is still usable".
 *
 * ## Why this is the engine's, not the native viewer's
 *
 * Capture has two clients. The viewer *publishes* its document to the capture
 * registry so a high-DPI render can borrow it; `lib/renderPageToImage.ts`
 * *borrows* it, and when nothing is mounted it needs a document of its own.
 *
 * Both need the same thing — a `PDFPageProxy` narrowed to `getViewport` +
 * `render`, plus an honest liveness answer — and both need it from the engine,
 * because the engine is the only place allowed to import PDF.js. Leaving that
 * capability in `native/` meant `lib/` had to reach sideways into the native
 * viewer boundary to reach the engine, which was the one direction-inverted edge
 * in the feature. It is the engine's job, so it lives here.
 *
 * Nothing in this file is viewer-specific: no React, no DOM, no viewer package,
 * no UI.
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
 *  - **unmount** — `manager.destroy()` clears the active document and marks the
 *    manager destroyed
 *
 * ## Ownership
 *
 * A temporary document is loaded through a **fresh** `PdfDocumentManager`, and
 * `release()` calls `manager.destroy()` — the same single teardown call the viewer
 * uses, which reaches `PDFDocumentLoadingTask#destroy()` and aborts the worker-side
 * work with it. Nothing else is needed: no page `cleanup()`, no document
 * `destroy()`, because the loading task owns all of it. A load that *rejects* never
 * reaches the caller, so nothing can call `release()` for it: the adapter destroys
 * the manager itself, which disposes whatever task `load()` left behind.
 *
 * A borrowed handle from a mounted viewer has no `release()` at all. Capture
 * cannot end that document's life even by accident, which is the invariant the
 * whole registry contract exists to protect.
 */
import type { PageViewport, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

import type { ActivePdfDocumentHandle, CaptureDocumentPage } from '../lib/activePdfDocumentRegistry'
import type { PdfDocumentManager } from './documentManager'
import { createPdfDocumentManager } from './documentManager'

/** Narrow a PDF.js page proxy to the capture page surface. */
function toCapturePage(page: PDFPageProxy): CaptureDocumentPage {
  return {
    getViewport: ({ scale }) => page.getViewport({ scale }),
    render: ({ canvasContext, viewport }) =>
      // Capture measures a page with `getViewport` and renders that same
      // measurement straight back, so the value really is this page's own
      // `PageViewport`; the assertion only recovers the identity that the
      // runtime-agnostic boundary erases.
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
 * The mounted viewer's document, as a capture handle.
 *
 * Published to the capture registry once the document is ready.
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
  try {
    const document = await manager.load(url)
    if (!document) {
      // Only reachable if something destroyed the manager between the two calls,
      // which cannot happen for a local instance — but leaving a loading task
      // behind would be a leak, so the failure path still tears it down.
      throw new Error('Capture document load was superseded before it resolved')
    }

    return {
      handle: createHandle(manager, () => true),
      release: () => manager.destroy()
    }
  } catch (error) {
    // The caller can only reach `release()` once this resolves, so a load that
    // rejects has nobody left to tear the task down — and a rejected load is the
    // common case here, since the temporary path exists precisely for the moments
    // there is nothing to borrow. `load()` has already disposed its own task and
    // emptied the slot, so this reaches nothing twice; `destroy()` is idempotent
    // in any case, and it also marks the manager dead so a late resolution could
    // not publish.
    manager.destroy()
    throw error
  }
}

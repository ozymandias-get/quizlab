/**
 * Page-proxy cache: page number → `PDFPageProxy`.
 *
 * `PDFDocumentProxy.getPage` is itself memoised by PDF.js, so this cache is not
 * about avoiding work — it is about giving the engine an explicit, clearable
 * ownership boundary. When the document is reloaded or destroyed the cached
 * proxies belong to a dead loading task, and holding them would let a caller
 * render into a torn-down document.
 *
 * Rejections are deliberately **not** cached: a transient failure (a page whose
 * objects have not finished parsing) must be retryable.
 *
 * Scope is intentionally minimal — no LRU, no size cap. Single-page view mode
 * keeps exactly one entry alive in practice, and adding eviction policy before
 * the native viewer exists would be speculation.
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-6'

/** The document operations this cache needs. Narrow on purpose. */
export type PageSource = Pick<PDFDocumentProxy, 'getPage'>

export interface PdfPageCache {
  getPage(pageNumber: number): Promise<PDFPageProxy>
  /** Drop every cached page. Does not touch the document itself. */
  clear(): void
  /** Number of cached pages. Exposed for tests and diagnostics. */
  readonly size: number
}

export function createPageCache(document: PageSource): PdfPageCache {
  const pages = new Map<number, Promise<PDFPageProxy>>()

  return {
    getPage(pageNumber: number): Promise<PDFPageProxy> {
      const cached = pages.get(pageNumber)
      if (cached) return cached

      const pending = document.getPage(pageNumber)
      pages.set(pageNumber, pending)
      // A failed lookup must not poison the cache.
      pending.catch(() => {
        if (pages.get(pageNumber) === pending) {
          pages.delete(pageNumber)
        }
      })
      return pending
    },

    clear(): void {
      pages.clear()
    },

    get size(): number {
      return pages.size
    }
  }
}

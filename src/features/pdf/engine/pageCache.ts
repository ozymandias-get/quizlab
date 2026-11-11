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
 * Scope is intentionally minimal — an LRU cap over the app-side map and nothing
 * else. The cap bounds what this cache retains while a document is open; it does
 * **not** free the page proxies themselves, because `PDFDocumentProxy` keeps its
 * own `#pagePromises` for the document's lifetime. A page dropped here is simply
 * looked up again (cheaply, from that internal cache) if it is revisited. Real
 * memory reclamation needs `page.cleanup()`, which this cache must not call for a
 * shared document: it clears the viewer's decoded-object cache and forces a
 * font/image re-decode on the next repaint.
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

/** The document operations this cache needs. Narrow on purpose. */
type PageSource = Pick<PDFDocumentProxy, 'getPage'>

/**
 * How many page proxies the app-side map keeps. A single-page view only touches
 * one page at a time, so a handful of entries covers scroll-ahead and capture
 * without letting a long reading session grow the map without bound.
 */
export const DEFAULT_MAX_CACHED_PAGES = 8

interface PdfPageCacheOptions {
  /** Upper bound on retained entries. Values below 1 are clamped to 1. */
  maxPages?: number
}

export interface PdfPageCache {
  getPage(pageNumber: number): Promise<PDFPageProxy>
  /** Drop every cached page. Does not touch the document itself. */
  clear(): void
  /** Number of cached pages. Exposed for tests and diagnostics. */
  readonly size: number
}

export function createPageCache(
  document: PageSource,
  options: PdfPageCacheOptions = {}
): PdfPageCache {
  const maxPages = Math.max(1, Math.floor(options.maxPages ?? DEFAULT_MAX_CACHED_PAGES))
  const pages = new Map<number, Promise<PDFPageProxy>>()

  /** Insert/re-insert as newest, then drop the least recently used entry. */
  const remember = (pageNumber: number, promise: Promise<PDFPageProxy>) => {
    pages.delete(pageNumber)
    pages.set(pageNumber, promise)
    while (pages.size > maxPages) {
      const oldest = pages.keys().next().value
      if (oldest === undefined) break
      pages.delete(oldest)
    }
  }

  return {
    getPage(pageNumber: number): Promise<PDFPageProxy> {
      const cached = pages.get(pageNumber)
      if (cached) {
        // Refresh recency so the page being read is the last to be evicted.
        remember(pageNumber, cached)
        return cached
      }

      const pending = document.getPage(pageNumber)
      remember(pageNumber, pending)
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

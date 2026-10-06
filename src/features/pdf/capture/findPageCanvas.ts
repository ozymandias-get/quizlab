import { findNativePageCanvas } from '@features/pdf/native/nativePdfDom'

/**
 * Owner of "which on-screen canvas belongs to page N".
 *
 * Both capture paths depend on it — the direct canvas clone in
 * `lib/renderPageToImage.ts` and the screenshot pipeline — so they share one
 * cache. The exact-page constraint is deliberate: never fall back to an arbitrary
 * canvas, that would capture the wrong page.
 *
 * The viewer keeps a single canvas, so the page attribute on the page box is the
 * *only* thing that can confirm the pixels belong to the page being asked for: a
 * page that is not mounted answers `null` rather than quietly handing back the
 * current page under the wrong label. That is stricter than "find a canvas", and
 * it is why returning `null` is a legitimate outcome here — `renderPageToImage`
 * then falls back to rendering the page from the document itself.
 *
 * Cache ownership: the cached canvas is dropped as soon as it leaves the DOM, so
 * a re-rasterized page is re-discovered rather than served stale.
 */
interface CachedCanvas {
  page: number
  canvas: HTMLCanvasElement
}

let canvasCache: CachedCanvas | null = null

export function findPageCanvas(currentPage: number): HTMLCanvasElement | null {
  if (canvasCache && !canvasCache.canvas.isConnected) {
    canvasCache = null
  }

  if (canvasCache && canvasCache.page === currentPage && canvasCache.canvas.isConnected) {
    return canvasCache.canvas
  }

  const canvas = findNativePageCanvas(document, currentPage)
  if (!canvas) return null

  canvasCache = { page: currentPage, canvas }
  return canvas
}

import {
  findNativePageCanvas,
  NATIVE_CANVAS_PAGE_ATTRIBUTE,
  NATIVE_PAGE_SELECTOR
} from '@features/pdf/native/nativePdfDom'

/**
 * Owner of "which on-screen canvas belongs to page N".
 *
 * Both capture paths depend on it — the direct canvas clone in
 * `lib/renderPageToImage.ts` and the screenshot pipeline — so they share one
 * cache. The exact-page constraint is deliberate: never fall back to an arbitrary
 * canvas, that would capture the wrong page.
 *
 * The viewer keeps a single canvas, so neither the page box nor the canvas can
 * confirm the pixels on their own: the page box says which page is being *asked
 * for*, and the canvas says which one it is *holding*, and between a page change and
 * the render that answers it the two disagree on purpose. A canvas is handed back
 * only when both name the page — see `nativePdfDom#findNativePageCanvas`. A page
 * that is not on screen, or whose render has not committed, answers `null` rather
 * than quietly handing back the current page under the wrong label; `renderPageToImage`
 * then falls back to rendering the page from the document itself.
 *
 * Cache ownership: the cached canvas is re-checked against exactly the conditions the
 * lookup enforces, so the cache can never serve a canvas the lookup would have
 * refused — a canvas that left the DOM, whose backing store was released, or whose
 * committed page moved on is re-discovered rather than served stale.
 */
interface CachedCanvas {
  page: number
  canvas: HTMLCanvasElement
}

let canvasCache: CachedCanvas | null = null

export function findPageCanvas(currentPage: number): HTMLCanvasElement | null {
  if (
    canvasCache &&
    (!canvasCache.canvas.isConnected ||
      canvasCache.canvas.width <= 0 ||
      canvasCache.canvas.height <= 0 ||
      canvasCache.canvas.closest(NATIVE_PAGE_SELECTOR)?.getAttribute('data-native-pdf-page') !==
        String(canvasCache.page) ||
      canvasCache.canvas.getAttribute(NATIVE_CANVAS_PAGE_ATTRIBUTE) !== String(canvasCache.page))
  ) {
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

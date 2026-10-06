import { pageLayerSelectors } from '../lib/pdfViewerDom'

/**
 * Owner of "which on-screen canvas belongs to page N".
 *
 * Both capture paths depend on it — the direct canvas clone in
 * `lib/renderPageToImage.ts` and the screenshot pipeline — so they share one
 * cache. The exact-page constraint is deliberate: never fall back to an arbitrary
 * canvas, that would capture the wrong page.
 *
 * Selectors come from `lib/pdfViewerDom`, the single owner of the viewer's
 * private DOM.
 *
 * Cache ownership: the cached canvas is dropped as soon as it leaves the DOM, so
 * a re-rasterized page is re-discovered rather than served stale.
 */
interface CachedCanvas {
  page: number
  canvas: HTMLCanvasElement
}

let canvasCache: CachedCanvas | null = null

function findLayerForPage(pageNumber: number): Element | null {
  for (const selector of pageLayerSelectors(pageNumber)) {
    const element = document.querySelector(selector)
    if (element) return element
  }
  return null
}

export function findPageCanvas(currentPage: number): HTMLCanvasElement | null {
  if (canvasCache && !canvasCache.canvas.isConnected) {
    canvasCache = null
  }

  if (canvasCache && canvasCache.page === currentPage && canvasCache.canvas.isConnected) {
    return canvasCache.canvas
  }

  const layer = findLayerForPage(currentPage)
  if (!layer) return null

  const canvas = layer.querySelector('canvas') as HTMLCanvasElement | null
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null

  canvasCache = { page: currentPage, canvas }
  return canvas
}

/**
 * Single owner of "which on-screen canvas belongs to page N".
 *
 * Both capture paths depend on it — the direct canvas clone in
 * `lib/renderPageToImage.ts` and the screenshot pipeline — so the selector list
 * below is the only place in the app that encodes @react-pdf-viewer's private
 * page-layer DOM. Keep it in sync with a viewer upgrade, and keep the exact-page
 * constraint: never fall back to an arbitrary canvas, that would capture the
 * wrong page.
 */
interface CachedCanvas {
  page: number
  canvas: HTMLCanvasElement
}

let canvasCache: CachedCanvas | null = null

function findLayerForPage(pageNumber: number): Element | null {
  const virtualIndex = pageNumber - 1
  const selectors = [
    `.rpv-core__page-layer[data-page-number="${pageNumber}"]`,
    `.rpv-core__page-layer[data-virtual-index="${virtualIndex}"]`,
    `[data-testid="core__page-layer-${virtualIndex}"]`,
    `.pdf-page-wrapper[data-page-number="${pageNumber}"]`,
    `.pdf-page-wrapper[data-virtual-index="${virtualIndex}"]`
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el) return el
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

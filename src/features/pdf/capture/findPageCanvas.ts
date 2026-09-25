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

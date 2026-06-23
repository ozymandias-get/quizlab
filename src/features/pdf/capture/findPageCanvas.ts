/**
 * Finds the best canvas element for the current PDF page.
 *
 * Performance: Uses a simple module-level cache keyed by page number
 * to avoid repeated DOM queries. The cache is invalidated on each call
 * by checking `isConnected` (O(1)) instead of re-querying the DOM.
 *
 * Fallback strategy:
 * 1. Try current page by data-page-number
 * 2. Try previous page as fallback
 * 3. Scan all visible canvases and pick the best match
 * 4. Fallback to any canvas in the viewer container
 */

interface CachedCanvas {
  page: number
  canvas: HTMLCanvasElement
}

let canvasCache: CachedCanvas | null = null

export function findPageCanvas(currentPage: number): HTMLCanvasElement | null {
  // Fast path: check cache first
  if (canvasCache && canvasCache.page === currentPage && canvasCache.canvas.isConnected) {
    return canvasCache.canvas
  }

  const pageNumberCandidates = [currentPage, currentPage - 1]

  for (const pageNumber of pageNumberCandidates) {
    const layer =
      document.querySelector(`.rpv-core__page-layer[data-page-number="${pageNumber}"]`) ||
      document.querySelector(`.pdf-page-wrapper[data-page-number="${pageNumber}"]`)
    if (!layer) continue

    const canvas = layer.querySelector('canvas') as HTMLCanvasElement | null
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      canvasCache = { page: currentPage, canvas }
      return canvas
    }
  }

  // Cache miss — scan fallback canvases
  const container = document.querySelector('.pdf-viewer-container')
  if (!container) return null

  let bestCandidate: HTMLCanvasElement | null = null
  let nearestPageDistance = Number.POSITIVE_INFINITY
  let maxVisibleArea = -1

  const allCanvases = container.querySelectorAll<HTMLCanvasElement>(
    '.rpv-core__page-layer canvas, .pdf-page-wrapper canvas'
  )

  for (const canvas of allCanvases) {
    if (canvas.width === 0 || canvas.height === 0) continue

    const rect = canvas.getBoundingClientRect()
    const vTop = Math.max(0, rect.top)
    const vBottom = Math.min(window.innerHeight, rect.bottom)
    const vLeft = Math.max(0, rect.left)
    const vRight = Math.min(window.innerWidth, rect.right)

    if (vBottom <= vTop || vRight <= vLeft) continue

    const visibleArea = (vBottom - vTop) * (vRight - vLeft)
    const layer = (canvas.closest('.rpv-core__page-layer') ||
      canvas.closest('.pdf-page-wrapper')) as HTMLElement | null
    const layerPage = Number(layer?.dataset?.pageNumber ?? Number.NaN)
    const dist = Number.isFinite(layerPage)
      ? Math.abs(layerPage - currentPage)
      : Number.POSITIVE_INFINITY

    if (
      dist < nearestPageDistance ||
      (dist === nearestPageDistance && visibleArea > maxVisibleArea)
    ) {
      nearestPageDistance = dist
      maxVisibleArea = visibleArea
      bestCandidate = canvas
    }
  }

  if (bestCandidate) {
    canvasCache = { page: currentPage, canvas: bestCandidate }
    return bestCandidate
  }

  const fallback = container.querySelector('canvas') as HTMLCanvasElement | null
  if (fallback && fallback.width > 0) {
    canvasCache = { page: currentPage, canvas: fallback }
    return fallback
  }
  return null
}

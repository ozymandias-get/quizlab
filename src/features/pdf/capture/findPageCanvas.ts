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

function getLayerPageNumber(layer: HTMLElement | null): number | null {
  if (!layer) return null
  const pn = (layer as HTMLElement).dataset?.pageNumber
  if (pn != null && pn !== '') {
    const n = Number(pn)
    if (Number.isFinite(n)) return n
  }
  const vi = (layer as HTMLElement).dataset?.virtualIndex
  if (vi != null && vi !== '') {
    const n = Number(vi)
    if (Number.isFinite(n)) return n + 1
  }
  const testId = layer.getAttribute('data-testid')
  if (testId) {
    const m = testId.match(/core__page-layer-(\d+)/)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n)) return n + 1
    }
  }
  return null
}

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
  // A cached canvas that left the DOM must not be kept alive — it still holds
  // a GPU backing store and would otherwise block releaseCanvasGpuMemory.
  if (canvasCache && !canvasCache.canvas.isConnected) {
    canvasCache = null
  }

  // Fast path: check cache first
  if (canvasCache && canvasCache.page === currentPage && canvasCache.canvas.isConnected) {
    return canvasCache.canvas
  }

  const pageNumberCandidates = [currentPage, currentPage - 1]

  for (const pageNumber of pageNumberCandidates) {
    const layer = findLayerForPage(pageNumber)
    if (!layer) continue

    const canvas = layer.querySelector('canvas') as HTMLCanvasElement | null
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      // Only cache exact-page hits; caching a previous-page fallback under
      // currentPage would return the wrong page on the next call.
      if (pageNumber === currentPage) {
        canvasCache = { page: currentPage, canvas }
      }
      return canvas
    }
  }

  // Cache miss — scan fallback canvases
  const container = document.querySelector('.pdf-viewer-container') as HTMLElement | null
  if (!container) {
    // No viewer container yet — still try a global fallback before giving up
    const docCanvas = document.querySelector('canvas') as HTMLCanvasElement | null
    if (docCanvas && docCanvas.width > 0 && docCanvas.height > 0) {
      canvasCache = { page: currentPage, canvas: docCanvas }
      return docCanvas
    }
    return null
  }

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
    const layerPage = getLayerPageNumber(layer)
    const dist =
      layerPage != null && Number.isFinite(layerPage)
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
  if (fallback && fallback.width > 0 && fallback.height > 0) {
    canvasCache = { page: currentPage, canvas: fallback }
    return fallback
  }
  // Last resort: any canvas in the document (covers edge cases where
  // .pdf-viewer-container is not yet mounted but the viewer already
  // rendered inside a different wrapper).
  const docCanvas = document.querySelector('canvas') as HTMLCanvasElement | null
  if (docCanvas && docCanvas.width > 0 && docCanvas.height > 0) {
    canvasCache = { page: currentPage, canvas: docCanvas }
    return docCanvas
  }
  return null
}

export function clearFindPageCanvasCache(): void {
  canvasCache = null
}

/**
 * Finds the best canvas element for the current PDF page.
 * Uses the same strategy as the existing usePdfScreenshot hook:
 * 1. Try current page by data-page-number
 * 2. Try previous page as fallback
 * 3. Scan all visible canvases and pick the best match
 * 4. Fallback to any canvas in the viewer container
 */
export function findPageCanvas(currentPage: number): HTMLCanvasElement | null {
  const pageNumberCandidates = [currentPage, currentPage - 1]

  for (const pageNumber of pageNumberCandidates) {
    const layer = document.querySelector(`.rpv-core__page-layer[data-page-number="${pageNumber}"]`)
    if (!layer) continue

    const canvas = layer.querySelector('canvas') as HTMLCanvasElement | null
    if (canvas && canvas.width > 0 && canvas.height > 0) return canvas
  }

  const allCanvases = Array.from(
    document.querySelectorAll<HTMLCanvasElement>('.rpv-core__page-layer canvas')
  )

  let bestCandidate: HTMLCanvasElement | null = null
  let nearestPageDistance = Number.POSITIVE_INFINITY
  let maxVisibleArea = -1

  for (const canvas of allCanvases) {
    if (canvas.width === 0 || canvas.height === 0) continue

    const rect = canvas.getBoundingClientRect()
    const vTop = Math.max(0, rect.top)
    const vBottom = Math.min(window.innerHeight, rect.bottom)
    const vLeft = Math.max(0, rect.left)
    const vRight = Math.min(window.innerWidth, rect.right)

    if (vBottom <= vTop || vRight <= vLeft) continue

    const visibleArea = (vBottom - vTop) * (vRight - vLeft)
    const layer = canvas.closest('.rpv-core__page-layer') as HTMLElement | null
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

  if (bestCandidate) return bestCandidate

  const fallback = document.querySelector(
    '.pdf-viewer-container canvas'
  ) as HTMLCanvasElement | null
  return fallback && fallback.width > 0 ? fallback : null
}

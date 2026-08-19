/**
 * Releases GPU memory held by canvas elements that leave the DOM.
 *
 * In SinglePage mode the PDF viewer swaps page layers on every navigation and
 * on Viewer remounts. Chromium keeps the GPU backing store of a canvas alive
 * until `canvas.width`/`canvas.height` are reset to 0 (or the JS object is
 * GC'd). Over long sessions this inflates the GPU process and can lead to
 * OOM crashes. A MutationObserver zeroes every canvas that gets removed from
 * the viewer container, and the unmount path clears any remaining canvases.
 *
 * A total pixel-area budget guards against HiDPI/Retina blow-ups: when the
 * combined rasterized area exceeds the cap (e.g. 50 MP at DPR >= 2), the
 * largest canvases that are not currently on screen are demoted (width/height
 * zeroed) so the GPU process cannot run out of memory on large medical
 * textbooks or long documents.
 */
import { type RefObject, useEffect } from 'react'

/** Cap on total rasterized canvas area in pixels (50 megapixels). */
export const MAX_CANVAS_PIXEL_BUDGET = 50_000_000

function canvasArea(canvas: HTMLCanvasElement): number {
  return canvas.width * canvas.height
}

function isCanvasVisibleInViewport(canvas: HTMLCanvasElement): boolean {
  try {
    const rect = canvas.getBoundingClientRect()
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.top < window.innerHeight
    )
  } catch {
    return true
  }
}

function enforceCanvasPixelBudget(container: HTMLElement): void {
  const canvases = [...container.querySelectorAll<HTMLCanvasElement>('canvas')]
  let total = 0
  for (const canvas of canvases) {
    total += canvasArea(canvas)
  }
  if (total <= MAX_CANVAS_PIXEL_BUDGET) return

  // Release off-screen canvases first (largest first) until the budget holds.
  const offscreen = canvases
    .filter((c) => !isCanvasVisibleInViewport(c))
    .sort((a, b) => canvasArea(b) - canvasArea(a))

  for (const canvas of offscreen) {
    if (total <= MAX_CANVAS_PIXEL_BUDGET) break
    const area = canvasArea(canvas)
    releaseCanvasGpuMemory(canvas)
    total -= area
  }
}

export function releaseCanvasGpuMemory(canvas: HTMLCanvasElement): void {
  if (canvas.width === 0 && canvas.height === 0) return
  try {
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  } catch {
    // jsdom and exotic environments may not implement getContext; the
    // dimension reset below is what actually releases the GPU backing store.
  }
  canvas.width = 0
  canvas.height = 0
}

export function useCanvasGpuCleanup(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof MutationObserver === 'undefined') return

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (!(node instanceof HTMLElement)) continue
          if (node.tagName === 'CANVAS') {
            releaseCanvasGpuMemory(node as HTMLCanvasElement)
          } else {
            for (const canvas of node.querySelectorAll('canvas')) {
              releaseCanvasGpuMemory(canvas)
            }
          }
        }
      }
      // Enforce the pixel-area budget on any mutation (page swap, zoom
      // re-render, capture) so an unbounded rasterized area is never retained.
      enforceCanvasPixelBudget(container)
    })

    observer.observe(container, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      for (const canvas of container.querySelectorAll('canvas')) {
        releaseCanvasGpuMemory(canvas)
      }
    }
  }, [containerRef])
}

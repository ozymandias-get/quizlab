/**
 * Releases GPU memory held by canvas elements that leave the DOM.
 *
 * In SinglePage mode the PDF viewer swaps page layers on every navigation and
 * on Viewer remounts. Chromium keeps the GPU backing store of a canvas alive
 * until `canvas.width`/`canvas.height` are reset to 0 (or the JS object is
 * GC'd). Over long sessions this inflates the GPU process and can lead to
 * OOM crashes. A MutationObserver zeroes every canvas that gets removed from
 * the viewer container, and the unmount path clears any remaining canvases.
 */
import { type RefObject, useEffect } from 'react'

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

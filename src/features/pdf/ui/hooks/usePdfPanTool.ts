import { useEffect, useRef, useState, type RefObject } from 'react'
import { getInnerContainerFallback, getScrollableAncestor } from './pdfPanToolHelpers'

interface UsePdfPanToolOptions {
  containerRef: RefObject<HTMLElement | null>
  isPanMode: boolean
}

/**
 * Pointer-drag panning when `isPanMode` is on: scrolls the nearest scrollable
 * ancestor (e.g. react-pdf-viewer's inner container) or falls back to
 * [data-testid="core__inner-container"].
 */
export function usePdfPanTool({ containerRef, isPanMode }: UsePdfPanToolOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const scrollElRef = useRef<HTMLElement | null>(null)
  const lastRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const root = containerRef.current
    if (!root || !isPanMode) {
      return
    }

    const cleanupDrag = () => {
      scrollElRef.current = null
      lastRef.current = null
      setIsDragging(false)
    }

    const onPointerMove = (e: PointerEvent) => {
      const scrollEl = scrollElRef.current
      const last = lastRef.current
      if (!scrollEl || !last) return

      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      lastRef.current = { x: e.clientX, y: e.clientY }
      scrollEl.scrollLeft -= dx
      scrollEl.scrollTop -= dy
    }

    const onPointerUp = (e: PointerEvent) => {
      const scrollEl = scrollElRef.current
      if (scrollEl && typeof scrollEl.releasePointerCapture === 'function') {
        try {
          scrollEl.releasePointerCapture(e.pointerId)
        } catch {
          // ignore
        }
      }
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
      cleanupDrag()
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (!root.contains(e.target as Node)) return

      const target = e.target as Element
      let scrollHost = getScrollableAncestor(target, root)
      if (!scrollHost) {
        scrollHost = getInnerContainerFallback(root)
      }
      if (!scrollHost) return

      e.preventDefault()
      scrollElRef.current = scrollHost
      lastRef.current = { x: e.clientX, y: e.clientY }
      setIsDragging(true)

      try {
        scrollHost.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }

      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
      document.addEventListener('pointercancel', onPointerUp)
    }

    root.addEventListener('pointerdown', onPointerDown)
    return () => {
      root.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
      cleanupDrag()
    }
  }, [containerRef, isPanMode])

  return { isDragging }
}

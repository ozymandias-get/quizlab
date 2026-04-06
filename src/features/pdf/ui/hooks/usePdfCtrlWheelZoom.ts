import { useEffect, useRef, type RefObject } from 'react'
import { SpecialZoomLevel } from '@react-pdf-viewer/core'

import { PDF_ZOOM_MIN_SCALE, PDF_ZOOM_STEP } from '@features/pdf/constants/pdfZoom'

type ZoomTo = (scale: number | SpecialZoomLevel) => void

/**
 * Ctrl/Meta + wheel zoom on the PDF container (capture phase so browser page zoom is suppressed).
 * Page-turn wheel without modifiers stays handled by usePdfNavigation.
 */
export function usePdfCtrlWheelZoom(
  containerRef: RefObject<HTMLElement | null>,
  zoomTo: ZoomTo,
  scaleFactor: number,
  enabled: boolean,
  panMode: boolean
) {
  const zoomToRef = useRef(zoomTo)
  const scaleRef = useRef(scaleFactor)
  zoomToRef.current = zoomTo
  scaleRef.current = scaleFactor

  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if ((!e.ctrlKey && !e.metaKey) || panMode) return
      e.preventDefault()
      e.stopPropagation()
      const next =
        e.deltaY < 0
          ? scaleRef.current + PDF_ZOOM_STEP
          : Math.max(PDF_ZOOM_MIN_SCALE, scaleRef.current - PDF_ZOOM_STEP)
      zoomToRef.current(next)
    }

    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [containerRef, enabled, panMode])
}

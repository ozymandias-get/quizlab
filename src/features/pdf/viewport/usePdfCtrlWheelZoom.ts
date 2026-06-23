/**
 * Ctrl/Meta + wheel zoom on the PDF container (capture phase so browser page zoom is suppressed).
 * Page-turn wheel without modifiers stays handled by usePdfWheelNavigation.
 */
import {
  PDF_ZOOM_MAX_SCALE,
  PDF_ZOOM_MIN_SCALE,
  PDF_ZOOM_STEP
} from '@features/pdf/constants/pdfZoom'

import type { SpecialZoomLevel } from '@react-pdf-viewer/core'
import { type RefObject, useEffect, useRef } from 'react'

type ZoomTo = (scale: number | SpecialZoomLevel) => void

const WHEEL_ZOOM_THROTTLE_MS = 40

export function usePdfCtrlWheelZoom(
  containerRef: RefObject<HTMLElement | null>,
  zoomTo: ZoomTo,
  scaleFactor: number,
  enabled: boolean,
  panMode: boolean
) {
  const zoomToRef = useRef(zoomTo)
  const scaleRef = useRef(scaleFactor)
  const panModeRef = useRef(panMode)
  const lastZoomTimeRef = useRef(0)
  zoomToRef.current = zoomTo
  scaleRef.current = scaleFactor
  panModeRef.current = panMode

  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if ((!e.ctrlKey && !e.metaKey) || panModeRef.current) return

      const now = Date.now()
      if (now - lastZoomTimeRef.current < WHEEL_ZOOM_THROTTLE_MS) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      lastZoomTimeRef.current = now

      e.preventDefault()
      e.stopPropagation()
      const next =
        e.deltaY < 0
          ? Math.min(PDF_ZOOM_MAX_SCALE, scaleRef.current + PDF_ZOOM_STEP)
          : Math.max(PDF_ZOOM_MIN_SCALE, scaleRef.current - PDF_ZOOM_STEP)
      zoomToRef.current(next)
    }

    const listenerOptions = { passive: false, capture: true } as const
    el.addEventListener('wheel', handleWheel, listenerOptions)
    return () => {
      el.removeEventListener('wheel', handleWheel, listenerOptions)
    }
  }, [containerRef, enabled])
}

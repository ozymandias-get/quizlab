/**
 * Ctrl/Meta + wheel zoom on the PDF container (capture phase so browser page zoom is suppressed).
 * Page-turn wheel without modifiers stays handled by usePdfWheelNavigation.
 *
 * The channel is typed numerically: this hook only ever computes numbers from
 * `constants/pdfZoom` and passes them on, so it does not need to know that the
 * legacy caller's `zoomTo` also accepts `@react-pdf-viewer`'s
 * `SpecialZoomLevel`. A `(scale: number | SpecialZoomLevel) => void` is still
 * assignable to this parameter, so the legacy contract and its tests are
 * untouched — while the native viewer, which is numeric-only, can reuse the hook
 * without importing a `@react-pdf-viewer` type. See
 * `features/pdf/native/useNativePdfController.ts`.
 */
import {
  PDF_ZOOM_MAX_SCALE,
  PDF_ZOOM_MIN_SCALE,
  PDF_ZOOM_STEP
} from '@features/pdf/constants/pdfZoom'

import { type RefObject, useEffect, useRef } from 'react'

type ZoomTo = (scale: number) => void

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

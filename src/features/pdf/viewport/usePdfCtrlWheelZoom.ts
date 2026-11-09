/**
 * Ctrl/Meta + wheel zoom on the PDF container (capture phase so browser page zoom is suppressed).
 * Page-turn wheel without modifiers stays handled by usePdfWheelNavigation.
 *
 * The channel is typed numerically: this hook only ever computes numbers from
 * `constants/pdfZoom` and passes them on, so it never has to know which caller is
 * consuming the number. Every programmatic zoom source lands on one coalesced
 * channel, so a single clamp policy governs all of them.
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
  const pendingWheelDeltaRef = useRef(0)
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  zoomToRef.current = zoomTo
  scaleRef.current = scaleFactor
  panModeRef.current = panMode

  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return

    const applyWheelDelta = (deltaY: number) => {
      if (deltaY === 0) return
      const next =
        deltaY < 0
          ? Math.min(PDF_ZOOM_MAX_SCALE, scaleRef.current + PDF_ZOOM_STEP)
          : Math.max(PDF_ZOOM_MIN_SCALE, scaleRef.current - PDF_ZOOM_STEP)
      zoomToRef.current(next)
    }

    const flushTrailing = () => {
      trailingTimerRef.current = null
      const delta = pendingWheelDeltaRef.current
      pendingWheelDeltaRef.current = 0
      if (delta === 0) return
      lastZoomTimeRef.current = Date.now()
      applyWheelDelta(delta)
    }

    const handleWheel = (e: WheelEvent) => {
      if ((!e.ctrlKey && !e.metaKey) || panModeRef.current) return

      e.preventDefault()
      e.stopPropagation()
      const now = Date.now()
      if (now - lastZoomTimeRef.current < WHEEL_ZOOM_THROTTLE_MS) {
        // Do not drop the tail of a fast trackpad gesture: accumulate it and
        // apply one trailing step when the throttle window ends.
        pendingWheelDeltaRef.current += e.deltaY
        if (trailingTimerRef.current === null) {
          trailingTimerRef.current = setTimeout(
            flushTrailing,
            Math.max(0, WHEEL_ZOOM_THROTTLE_MS - (now - lastZoomTimeRef.current))
          )
        }
        return
      }
      // An event outside the window must not discard the tail that was
      // accumulated inside it. Fold both into one step and cancel the timer
      // that would have applied the tail later.
      const accumulated = pendingWheelDeltaRef.current
      pendingWheelDeltaRef.current = 0
      if (trailingTimerRef.current !== null) {
        clearTimeout(trailingTimerRef.current)
        trailingTimerRef.current = null
      }
      lastZoomTimeRef.current = now
      applyWheelDelta(accumulated === 0 ? e.deltaY : accumulated + e.deltaY)
    }

    const listenerOptions = { passive: false, capture: true } as const
    el.addEventListener('wheel', handleWheel, listenerOptions)
    return () => {
      el.removeEventListener('wheel', handleWheel, listenerOptions)
      if (trailingTimerRef.current !== null) {
        clearTimeout(trailingTimerRef.current)
        trailingTimerRef.current = null
      }
      pendingWheelDeltaRef.current = 0
    }
  }, [containerRef, enabled])
}

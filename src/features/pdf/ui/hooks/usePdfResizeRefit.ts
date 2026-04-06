import { useEffect, useRef, type RefObject } from 'react'
import { SpecialZoomLevel } from '@react-pdf-viewer/core'

import {
  PDF_REFIT_SPINNER_SUPPRESS_MS,
  PDF_RESIZE_REFIT_DEBOUNCE_MS,
  PDF_HUB_DRAG_REFIT_INTERVAL_MS
} from '@features/pdf/constants/pdfZoom'
import {
  PANEL_RESIZING_BODY_CLASS,
  PDF_REFIT_SPINNER_SUPPRESS_BODY_CLASS
} from '@shared/constants/panelResize'

type ZoomTo = (scale: number | SpecialZoomLevel) => void

const DRAG_END_SETTLE_MS = 60

const DRAG_END_EXTRA_SUPPRESS_MS = 150

export function usePdfResizeRefit(
  containerRef: RefObject<HTMLElement | null>,
  zoomTo: ZoomTo,
  enabled: boolean,
  isPanelResizing: boolean
) {
  const zoomToRef = useRef(zoomTo)
  zoomToRef.current = zoomTo
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resizeRafRef = useRef<number | null>(null)
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hubDragThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHubRefitAtRef = useRef(Number.NEGATIVE_INFINITY)
  const spinnerSuppressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPanelResizingRef = useRef(isPanelResizing)
  isPanelResizingRef.current = isPanelResizing
  const prevPanelResizingRef = useRef(isPanelResizing)

  const isHubResizeActive = () =>
    isPanelResizingRef.current ||
    (typeof document !== 'undefined' && document.body.classList.contains(PANEL_RESIZING_BODY_CLASS))

  const clearResizePending = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (resizeRafRef.current !== null) {
      cancelAnimationFrame(resizeRafRef.current)
      resizeRafRef.current = null
    }
  }

  const clearHubDragThrottle = () => {
    if (hubDragThrottleTimerRef.current !== null) {
      clearTimeout(hubDragThrottleTimerRef.current)
      hubDragThrottleTimerRef.current = null
    }
  }

  const clearDragEndTimer = () => {
    if (dragEndTimerRef.current !== null) {
      clearTimeout(dragEndTimerRef.current)
      dragEndTimerRef.current = null
    }
  }

  const runRefit = (extraSuppressMs = 0) => {
    if (typeof document !== 'undefined') {
      document.body.classList.add(PDF_REFIT_SPINNER_SUPPRESS_BODY_CLASS)
      if (spinnerSuppressTimeoutRef.current) {
        clearTimeout(spinnerSuppressTimeoutRef.current)
      }
      spinnerSuppressTimeoutRef.current = setTimeout(() => {
        spinnerSuppressTimeoutRef.current = null
        document.body.classList.remove(PDF_REFIT_SPINNER_SUPPRESS_BODY_CLASS)
      }, PDF_REFIT_SPINNER_SUPPRESS_MS + extraSuppressMs)
    }
    zoomToRef.current(SpecialZoomLevel.PageFit)
  }

  useEffect(() => {
    if (!enabled) {
      prevPanelResizingRef.current = isPanelResizing
      return
    }
    const was = prevPanelResizingRef.current
    prevPanelResizingRef.current = isPanelResizing
    if (was && !isPanelResizing) {
      clearHubDragThrottle()
      clearDragEndTimer()
      dragEndTimerRef.current = setTimeout(() => {
        dragEndTimerRef.current = null
        runRefit(DRAG_END_EXTRA_SUPPRESS_MS)
        lastHubRefitAtRef.current = performance.now()
      }, DRAG_END_SETTLE_MS)
    }
  }, [enabled, isPanelResizing])

  useEffect(() => {
    if (isPanelResizing) clearResizePending()
  }, [isPanelResizing])

  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const scheduleHubDragRefit = () => {
      const now = performance.now()
      const wait = PDF_HUB_DRAG_REFIT_INTERVAL_MS
      const last = lastHubRefitAtRef.current
      const elapsed = now - last
      if (elapsed >= wait) {
        lastHubRefitAtRef.current = now
        runRefit()
        return
      }
      if (hubDragThrottleTimerRef.current !== null) return
      hubDragThrottleTimerRef.current = setTimeout(() => {
        hubDragThrottleTimerRef.current = null
        lastHubRefitAtRef.current = performance.now()
        if (!enabled) return
        if (!containerRef.current) return
        if (!isHubResizeActive()) return
        runRefit()
      }, wait - elapsed)
    }

    const schedule = () => {
      if (isHubResizeActive()) {
        clearResizePending()
        scheduleHubDragRefit()
        return
      }

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (isHubResizeActive()) return
        if (resizeRafRef.current !== null) cancelAnimationFrame(resizeRafRef.current)
        resizeRafRef.current = requestAnimationFrame(() => {
          resizeRafRef.current = null
          if (isHubResizeActive()) return
          runRefit()
        })
      }, PDF_RESIZE_REFIT_DEBOUNCE_MS)
    }

    const ro = new ResizeObserver(() => {
      schedule()
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      clearResizePending()
      clearHubDragThrottle()
      clearDragEndTimer()
      if (spinnerSuppressTimeoutRef.current) {
        clearTimeout(spinnerSuppressTimeoutRef.current)
        spinnerSuppressTimeoutRef.current = null
      }
      document.body.classList.remove(PDF_REFIT_SPINNER_SUPPRESS_BODY_CLASS)
    }
  }, [containerRef, enabled])
}

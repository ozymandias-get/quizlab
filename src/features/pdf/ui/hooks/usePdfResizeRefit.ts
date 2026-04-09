import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { SpecialZoomLevel } from '@react-pdf-viewer/core'

import { PDF_RESIZE_REFIT_DEBOUNCE_MS } from '@features/pdf/constants/pdfZoom'

type ZoomTo = (scale: number | SpecialZoomLevel) => void

export function usePdfResizeRefit(
  containerRef: RefObject<HTMLElement | null>,
  zoomTo: ZoomTo,
  enabled: boolean,
  isPanelResizing: boolean
) {
  const zoomToRef = useRef(zoomTo)
  const enabledRef = useRef(enabled)
  const isPanelResizingRef = useRef(isPanelResizing)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousPanelResizingRef = useRef(isPanelResizing)

  zoomToRef.current = zoomTo
  enabledRef.current = enabled
  isPanelResizingRef.current = isPanelResizing

  const clearPendingRefit = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [])

  const scheduleRefit = useCallback(() => {
    clearPendingRefit()
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null

      if (!enabledRef.current || isPanelResizingRef.current || !containerRef.current) {
        return
      }

      zoomToRef.current(SpecialZoomLevel.PageWidth)
    }, PDF_RESIZE_REFIT_DEBOUNCE_MS)
  }, [clearPendingRefit, containerRef])

  useEffect(() => {
    if (!enabled) {
      clearPendingRefit()
      previousPanelResizingRef.current = isPanelResizing
      return
    }

    const wasPanelResizing = previousPanelResizingRef.current
    previousPanelResizingRef.current = isPanelResizing

    if (isPanelResizing) {
      clearPendingRefit()
      return
    }

    if (wasPanelResizing) {
      scheduleRefit()
    }
  }, [clearPendingRefit, enabled, isPanelResizing, scheduleRefit])

  useEffect(() => {
    if (!enabled || isPanelResizing) {
      return
    }

    const element = containerRef.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      if (isPanelResizingRef.current) {
        return
      }

      scheduleRefit()
    })

    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
      clearPendingRefit()
    }
  }, [clearPendingRefit, containerRef, enabled, isPanelResizing, scheduleRefit])

  useEffect(() => clearPendingRefit, [clearPendingRefit])
}

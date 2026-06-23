/**
 * ResizeObserver-based refit: debounces container resize events and
 * fits to PageWidth when resize settles. Prevents refit spam during
 * panel resizing and uses a cooldown to avoid flood.
 */
import { PDF_RESIZE_REFIT_DEBOUNCE_MS } from '@features/pdf/constants/pdfZoom'

import { SpecialZoomLevel } from '@react-pdf-viewer/core'
import { type RefObject, useCallback, useEffect, useRef } from 'react'

type ZoomTo = (scale: number | SpecialZoomLevel) => void

const RESIZE_OBSERVER_COOLDOWN_MS = 300
const NAVIGATION_REFIT_LOCK_MS = 500

export function usePdfResizeRefit(
  containerRef: RefObject<HTMLElement | null>,
  zoomTo: ZoomTo,
  enabled: boolean,
  isPanelResizing: boolean,
  fitScale?: number | null,
  lastNavigationTimeRef?: { readonly current: number }
) {
  const zoomToRef = useRef(zoomTo)
  const enabledRef = useRef(enabled)
  const isPanelResizingRef = useRef(isPanelResizing)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousPanelResizingRef = useRef(isPanelResizing)
  const previousEnabledRef = useRef(enabled)
  const resizeObserverCooldownRef = useRef(false)
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fitScaleRef = useRef(fitScale ?? null)

  zoomToRef.current = zoomTo
  enabledRef.current = enabled
  isPanelResizingRef.current = isPanelResizing
  fitScaleRef.current = fitScale ?? null

  const clearPendingRefit = () => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (cooldownTimerRef.current !== null) {
      clearTimeout(cooldownTimerRef.current)
      cooldownTimerRef.current = null
    }
  }

  const scheduleRefit = useCallback(() => {
    clearPendingRefit()

    // Skip refit if a page navigation just happened (within lock window)
    if (lastNavigationTimeRef && lastNavigationTimeRef.current > 0) {
      const elapsed = Date.now() - lastNavigationTimeRef.current
      if (elapsed < NAVIGATION_REFIT_LOCK_MS) {
        return
      }
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null

      if (!enabledRef.current || isPanelResizingRef.current || !containerRef.current) {
        return
      }

      // Wait for the next frame so the browser has computed the final
      // container size. Focus overlays animate in, async layout can
      // settle after the timer fires — zooming to the pre-frame size
      // would lock the PDF at a stale (often smaller) scale.
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          if (!enabledRef.current || isPanelResizingRef.current || !containerRef.current) {
            return
          }
          zoomToRef.current(fitScaleRef.current ?? SpecialZoomLevel.PageWidth)
        })
      } else {
        zoomToRef.current(fitScaleRef.current ?? SpecialZoomLevel.PageWidth)
      }
    }, PDF_RESIZE_REFIT_DEBOUNCE_MS)
  }, [clearPendingRefit, containerRef])

  useEffect(() => {
    if (!enabled) {
      clearPendingRefit()
      previousPanelResizingRef.current = isPanelResizing
      previousEnabledRef.current = false
      return
    }

    const wasPanelResizing = previousPanelResizingRef.current
    const wasEnabled = previousEnabledRef.current
    previousPanelResizingRef.current = isPanelResizing
    previousEnabledRef.current = true

    if (isPanelResizing) {
      clearPendingRefit()
      resizeObserverCooldownRef.current = false
      return
    }

    // Schedule a refit whenever we transition from "no document" to
    // "document ready". The ResizeObserver below will also fire with the
    // initial size, but on the first paint the container is often still
    // settling (focus overlays animate in, async layout, etc.) so the
    // observer's first reading can be stale or zero. Forcing a refit
    // here guarantees PageWidth kicks in even if the observer's initial
    // callback never lands.
    if (!wasEnabled) {
      scheduleRefit()
      return
    }

    if (wasPanelResizing) {
      resizeObserverCooldownRef.current = true
      scheduleRefit()

      cooldownTimerRef.current = setTimeout(() => {
        cooldownTimerRef.current = null
        resizeObserverCooldownRef.current = false
      }, RESIZE_OBSERVER_COOLDOWN_MS)
    }
  }, [clearPendingRefit, enabled, isPanelResizing, scheduleRefit])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const element = containerRef.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      // Fully passive during drag — no timer setup, no refit scheduling.
      // Drag-end refit is handled by the isPanelResizing transition effect.
      if (isPanelResizingRef.current) return
      if (resizeObserverCooldownRef.current) return

      // Skip during page navigation — layout is in flux from pages being
      // mounted/unmounted. The container size hasn't actually changed.
      if (lastNavigationTimeRef && lastNavigationTimeRef.current > 0) {
        const elapsed = Date.now() - lastNavigationTimeRef.current
        if (elapsed < NAVIGATION_REFIT_LOCK_MS) return
      }

      scheduleRefit()
    })

    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
      clearPendingRefit()
    }
  }, [clearPendingRefit, containerRef, enabled, scheduleRefit])
}

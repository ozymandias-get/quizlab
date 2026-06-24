import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'

const NAVIGATION_CONTAINER_SIZE_LOCK_MS = 500
const PANEL_RESIZE_THROTTLE_MS = 50

/**
 * Tracks the container size via ResizeObserver, returning reactive state.
 *
 * Accepts optional guards to skip noisy resize events:
 * - `lastNavigationTimeRef` – ignores resizes within `NAVIGATION_CONTAINER_SIZE_LOCK_MS`
 *   of a page navigation, preventing Viewer re-render during transitions.
 * - `isPanelResizing` – when `true`, resize events are throttled to `PANEL_RESIZE_THROTTLE_MS`
 *   instead of being skipped entirely, so the PDF continuously refits during drag.
 *   The final size is captured after the drag ends via manual measurement.
 */
export function useContainerSize(
  containerRef: RefObject<HTMLDivElement | null>,
  lastNavigationTimeRef?: { readonly current: number },
  isPanelResizing?: boolean
) {
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const isPanelResizingRef = useRef(isPanelResizing)
  const lastUpdateRef = useRef(0)
  isPanelResizingRef.current = isPanelResizing

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const w = Math.round(width)
        const h = Math.round(height)

        if (isPanelResizingRef.current) {
          // Throttle updates during panel drag so the PDF continuously
          // refits without repainting on every single resize frame.
          const now = Date.now()
          if (now - lastUpdateRef.current < PANEL_RESIZE_THROTTLE_MS) return
          lastUpdateRef.current = now
        } else {
          // Suppress resize updates during page navigation to avoid
          // triggering a Viewer re-render via fitScale change.
          if (lastNavigationTimeRef && lastNavigationTimeRef.current > 0) {
            const elapsed = Date.now() - lastNavigationTimeRef.current
            if (elapsed < NAVIGATION_CONTAINER_SIZE_LOCK_MS) {
              return
            }
          }
        }

        setContainerSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
      }
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [containerRef, lastNavigationTimeRef])

  // When panel resizing ends, manually measure the container size to ensure
  // we have the final dimensions (since ResizeObserver updates were throttled during drag).
  useEffect(() => {
    if (!isPanelResizing && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      setContainerSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
  }, [isPanelResizing, containerRef])

  return containerSize
}

const FIT_SCALE_PRECISION = 100

/**
 * Quantizes a scale value to 1 % granularity.
 *
 * This prevents sub-pixel container-size noise from producing a different
 * fitScale, which would otherwise trigger a full PDF re-paint through the
 * `<Viewer defaultScale>` prop every time ResizeObserver fires with a
 * ±1px fluctuation.
 *
 * The dead-zone is 0.5 % of the current scale (half the bucket). Changes
 * smaller than ~0.5 % are rounded away — a 1 px fluctuation on any
 * container wider than ~200 px is always absorbed:
 *
 *   scale=1.2350 → Math.round(1.2350 × 100) / 100 = 1.24
 *   scale=1.2340 → Math.round(1.2340 × 100) / 100 = 1.23   ← same bucket
 *   scale=1.2450 → Math.round(1.2450 × 100) / 100 = 1.25   ← new bucket
 */
function quantizeScale(scale: number): number {
  return Math.round(scale * FIT_SCALE_PRECISION) / FIT_SCALE_PRECISION
}

export function useFitScale(
  pageDimensions: { width: number; height: number } | null,
  containerSize: { w: number; h: number }
) {
  return useMemo(() => {
    if (!pageDimensions || containerSize.w <= 0 || containerSize.h <= 0) return null
    const rawScale = Math.min(
      containerSize.w / pageDimensions.width,
      containerSize.h / pageDimensions.height
    )
    return quantizeScale(rawScale)
  }, [pageDimensions, containerSize])
}

export function useLastNavigationTime(currentPage: number) {
  const lastNavigationTimeRef = useRef(0)
  const prevPageRef = useRef(currentPage)

  if (currentPage !== prevPageRef.current) {
    prevPageRef.current = currentPage
    lastNavigationTimeRef.current = Date.now()
  }

  return lastNavigationTimeRef
}

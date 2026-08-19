/**
 * Coalesces zoom requests into one zoomTo call per animation frame.
 *
 * Rapid zoom sources (Ctrl+wheel, IPC zoom, resize refit, resume flow) can
 * fire multiple zoomTo calls within the same frame. Each one starts a new
 * pdf.js page render while the previous render is still being cancelled —
 * this is the primary source of RenderingCancelledException races and
 * "canvas context is locked" errors in SinglePage mode. Keeping only the
 * latest zoom per frame serializes renders naturally.
 */
import type { SpecialZoomLevel } from '@react-pdf-viewer/core'
import { useCallback, useEffect, useRef } from 'react'

type ZoomTo = (scale: number | SpecialZoomLevel) => void

export function useCoalescedZoom(zoomTo: ZoomTo): ZoomTo {
  const zoomToRef = useRef(zoomTo)
  const pendingScaleRef = useRef<number | SpecialZoomLevel | null>(null)
  const rafIdRef = useRef<number | null>(null)

  zoomToRef.current = zoomTo

  const flush = useCallback(() => {
    rafIdRef.current = null
    const scale = pendingScaleRef.current
    pendingScaleRef.current = null
    if (scale !== null) {
      zoomToRef.current(scale)
    }
  }, [])

  const schedule = useCallback(
    (scale: number | SpecialZoomLevel) => {
      pendingScaleRef.current = scale
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(flush)
      }
    },
    [flush]
  )

  useEffect(
    () => () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    },
    [flush]
  )

  return schedule
}

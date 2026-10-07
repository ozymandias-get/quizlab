/**
 * The PDF viewer's rAF-coalesced zoom channel.
 *
 * ## Why this channel is numeric
 *
 * It is `(scale: number) => void`, because that is the whole domain of a scale:
 * "fit to page width" is the number `useFitScale` computed, not a keyword. Routing
 * every programmatic zoom source through one coalesced channel is what keeps the
 * single-channel invariant reviewable — the toolbar buttons, Ctrl+wheel, the
 * resize refit, the initial fit, the keyboard shortcuts and the Electron context
 * menu all land on the same `zoomTo`.
 *
 * ## One effective zoom change per animation frame
 *
 * Rapid zoom sources (toolbar buttons, Ctrl+wheel, resize refit, the initial
 * fit) can fire several times inside one frame. Each committed zoom change
 * supersedes the previous page render, which is the primary source of
 * `RenderingCancelledException` races in single-page mode. Only the latest pending
 * value survives ("latest wins"), so intermediate values never reach the render at
 * all.
 *
 * The pending frame is cancelled on unmount so a queued zoom cannot commit into
 * a torn-down engine.
 */
import { useCallback, useEffect, useRef } from 'react'

export type NumericZoomTo = (scale: number) => void

export function useNativeCoalescedScale(zoomTo: NumericZoomTo): NumericZoomTo {
  const zoomToRef = useRef(zoomTo)
  const pendingScaleRef = useRef<number | null>(null)
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
    (scale: number) => {
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
        rafIdRef.current = null
      }
      pendingScaleRef.current = null
    },
    [flush]
  )

  return schedule
}

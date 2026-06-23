/**
 * ScrollMode.Page modunda fare tekerleği ile sayfa geçişi.
 *
 * Ctrl/Meta tuşu olmadan tekerlek → sayfa geçişi (usePdfCtrlWheelZoom'a bırakılmaz).
 * Ctrl/Meta + tekerlek → usePdfCtrlWheelZoom tarafından işlenir (zoom), burada dokunulmaz.
 *
 * Tek bir wheel hareketinin momentum/artçı olayları yalnızca bir sayfa geçirir.
 * Yeni bir geçiş ancak wheel olayları kısa süre tamamen durduktan sonra kabul edilir.
 */
import { type RefObject, useEffect, useRef } from 'react'

const WHEEL_GESTURE_IDLE_MS = 240
const OPPOSITE_DIRECTION_LOCK_MS = 900

type WheelDirection = -1 | 1

export function usePdfWheelNavigation(
  containerRef: RefObject<HTMLElement | null>,
  goToNextPage: () => void,
  goToPreviousPage: () => void,
  enabled: boolean
) {
  const goToNextRef = useRef(goToNextPage)
  const goToPrevRef = useRef(goToPreviousPage)
  const gestureLockedRef = useRef(false)
  const gestureIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAcceptedDirectionRef = useRef<WheelDirection | null>(null)
  const lastAcceptedAtRef = useRef(0)

  goToNextRef.current = goToNextPage
  goToPrevRef.current = goToPreviousPage

  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      // Ctrl/Meta + tekerlek → zoom hook'una bırak
      if (e.ctrlKey || e.metaKey) return

      // Varsayılan scroll davranışını engelle (ScrollMode.Page zaten scroll etmez)
      e.preventDefault()
      e.stopPropagation()

      // Track the whole wheel gesture, not a fixed interval from the first event.
      // Trackpad momentum and some mouse drivers emit a late, occasionally
      // opposite delta. A fixed throttle lets that tail through and makes the
      // document bounce back to the page it came from.
      if (gestureIdleTimerRef.current !== null) {
        clearTimeout(gestureIdleTimerRef.current)
      }
      gestureIdleTimerRef.current = setTimeout(() => {
        gestureIdleTimerRef.current = null
        gestureLockedRef.current = false
      }, WHEEL_GESTURE_IDLE_MS)

      if (gestureLockedRef.current) return
      if (e.deltaY === 0) return
      gestureLockedRef.current = true

      const direction: WheelDirection = e.deltaY > 0 ? 1 : -1
      const now = Date.now()
      const isLateOppositeTail =
        lastAcceptedDirectionRef.current !== null &&
        direction !== lastAcceptedDirectionRef.current &&
        now - lastAcceptedAtRef.current < OPPOSITE_DIRECTION_LOCK_MS

      // Some mouse drivers emit an opposite-direction tail after their normal
      // momentum stream has already gone idle. The gesture idle lock alone
      // cannot distinguish that tail from a new gesture, so keep the accepted
      // direction sticky for a short safety window.
      if (isLateOppositeTail) return

      lastAcceptedDirectionRef.current = direction
      lastAcceptedAtRef.current = now

      if (direction > 0) {
        goToNextRef.current()
      } else if (e.deltaY < 0) {
        goToPrevRef.current()
      }
    }

    // capture: true → usePdfCtrlWheelZoom ile aynı aşamada yakalayarak öncelik sağlar
    const opts = { passive: false, capture: true } as const
    el.addEventListener('wheel', handleWheel, opts)
    return () => {
      el.removeEventListener('wheel', handleWheel, opts)
      if (gestureIdleTimerRef.current !== null) {
        clearTimeout(gestureIdleTimerRef.current)
        gestureIdleTimerRef.current = null
      }
      gestureLockedRef.current = false
      lastAcceptedDirectionRef.current = null
      lastAcceptedAtRef.current = 0
    }
  }, [containerRef, enabled])
}

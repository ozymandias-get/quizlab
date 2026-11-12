import type { UIEvent } from 'react'
import { useCallback, useEffect, useRef } from 'react'

/**
 * Coalesces scroll events into one callback per animation frame.
 *
 * A scroll container fires several events between frames; forwarding each one
 * to state re-renders a virtual window for offsets that have not changed yet.
 * The returned handler keeps the newest element reference, so a queued frame
 * always reports the position the user is actually at.
 */
export function useRafScrollTop(onScrollTop: (scrollTop: number) => void) {
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return useCallback(
    (event: UIEvent<HTMLElement>) => {
      const element = event.currentTarget
      if (frameRef.current !== null) return
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        onScrollTop(element.scrollTop)
      })
    },
    [onScrollTop]
  )
}

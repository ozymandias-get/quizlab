import { useLayoutEffect, useRef, useState } from 'react'

const SCROLL_CUE_TOLERANCE = 6

export const useBottomScrollCue = <T extends HTMLElement>(
  enabled: boolean,
  measuredHeight?: number | string
) => {
  const scrollAreaRef = useRef<T>(null)
  const [showScrollCue, setShowScrollCue] = useState(false)

  useLayoutEffect(() => {
    const scrollArea = scrollAreaRef.current

    if (!enabled || !scrollArea) {
      setShowScrollCue(false)
      return
    }

    let frameId: number | null = null

    const updateCueVisibility = () => {
      const remainingScroll =
        scrollArea.scrollHeight - scrollArea.clientHeight - scrollArea.scrollTop
      const nextVisible = remainingScroll > SCROLL_CUE_TOLERANCE

      setShowScrollCue((prev) => (prev === nextVisible ? prev : nextVisible))
    }

    const scheduleUpdate = () => {
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        updateCueVisibility()
        return
      }

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        updateCueVisibility()
      })
    }

    scheduleUpdate()
    scrollArea.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => scheduleUpdate()) : null

    resizeObserver?.observe(scrollArea)

    const content = scrollArea.firstElementChild
    if (content instanceof Element) {
      resizeObserver?.observe(content)
    }

    return () => {
      scrollArea.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
      resizeObserver?.disconnect()
    }
  }, [enabled, measuredHeight])

  return { scrollAreaRef, showScrollCue }
}

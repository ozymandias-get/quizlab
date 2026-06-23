import { useCallback, useEffect, useRef, useState } from 'react'

import { resolveTargetRects } from '../lib/targetResolution'

export function useTourTargetRects(
  targetIds: readonly string[],
  isActive: boolean
): Map<string, DOMRect> {
  const [rects, setRects] = useState<Map<string, DOMRect>>(new Map())
  const observerRef = useRef<ResizeObserver | null>(null)
  const rafRef = useRef<number>(0)

  const recalculate = useCallback(() => {
    if (!isActive || targetIds.length === 0) {
      setRects(new Map())
      return
    }

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setRects(resolveTargetRects(targetIds))
    })
  }, [isActive, targetIds])

  useEffect(() => {
    if (!isActive) {
      setRects(new Map())
      return
    }

    recalculate()

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null
    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(recalculate, 80)
    }

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(recalculate, 100)
    }

    observerRef.current = new ResizeObserver(recalculate)

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)

    const observeTargets = () => {
      if (!observerRef.current) return
      observerRef.current.disconnect()
      for (const targetId of targetIds) {
        const el =
          document.querySelector(`[data-tour-id="${targetId}"]`) ??
          document.getElementById(targetId)
        if (el) {
          observerRef.current.observe(el)
        }
      }
    }

    observeTargets()

    return () => {
      cancelAnimationFrame(rafRef.current)
      if (scrollTimeout) clearTimeout(scrollTimeout)
      if (resizeTimeout) clearTimeout(resizeTimeout)
      observerRef.current?.disconnect()
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [isActive, targetIds, recalculate])

  return rects
}

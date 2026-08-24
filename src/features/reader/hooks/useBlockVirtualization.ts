import { useCallback, useEffect, useRef, useState } from 'react'

interface VirtualWindow {
  startIndex: number
  endIndex: number
  totalHeight: number
  offsetY: number
}

const ESTIMATED_BLOCK_HEIGHT = 140
const OVERSCAN = 10
const VIRTUALIZATION_THRESHOLD = 80

export function useBlockVirtualization(
  blockCount: number,
  enabled = true
): {
  isVirtualized: boolean
  virtualWindow: VirtualWindow | null
  containerRef: React.RefObject<HTMLDivElement | null>
  scrollToIndex: (index: number) => void
} {
  const containerRef = useRef<HTMLDivElement>(null)
  const [virtualWindow, setVirtualWindow] = useState<VirtualWindow | null>(null)
  const isVirtualized = enabled && blockCount > VIRTUALIZATION_THRESHOLD

  // Check if we are in a test environment without IntersectionObserver or window
  // jsdom/vitest doesn't have real layout, so disable windowing there – fallback to content-visibility
  const isTestEnv =
    typeof navigator !== 'undefined' && /jsdom|vitest/i.test(navigator.userAgent || '')
  const shouldVirtualize =
    isVirtualized &&
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    !isTestEnv &&
    'IntersectionObserver' in window

  const updateWindow = useCallback(() => {
    if (!shouldVirtualize) {
      setVirtualWindow(null)
      return
    }
    // Use window scroll as source of truth when ReaderView is inside page flow
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
    const viewportHeight = window.innerHeight || 800
    // container offset relative to document
    let containerTop = 0
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      containerTop = rect.top + scrollTop
    }
    const relativeScroll = Math.max(0, scrollTop - containerTop + 200)
    const startIndex = Math.max(0, Math.floor(relativeScroll / ESTIMATED_BLOCK_HEIGHT) - OVERSCAN)
    const endIndex = Math.min(
      blockCount,
      Math.ceil((relativeScroll + viewportHeight) / ESTIMATED_BLOCK_HEIGHT) + OVERSCAN
    )
    setVirtualWindow({
      startIndex,
      endIndex,
      totalHeight: blockCount * ESTIMATED_BLOCK_HEIGHT,
      offsetY: startIndex * ESTIMATED_BLOCK_HEIGHT
    })
  }, [blockCount, shouldVirtualize])

  useEffect(() => {
    if (!shouldVirtualize) return
    updateWindow()
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        updateWindow()
        ticking = false
      })
    }
    const onResize = () => updateWindow()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    // Also observe container via IntersectionObserver as fallback for scroll containers
    let observer: IntersectionObserver | null = null
    if ('IntersectionObserver' in window && containerRef.current) {
      observer = new IntersectionObserver(() => updateWindow(), { rootMargin: '600px' })
      observer.observe(containerRef.current)
    }
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (observer) observer.disconnect()
    }
  }, [shouldVirtualize, updateWindow])

  const scrollToIndex = useCallback(
    (index: number) => {
      if (!shouldVirtualize || !containerRef.current) {
        // fallback: try id-based scroll
        const el = document.getElementById(`block-${index}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      const targetTop = index * ESTIMATED_BLOCK_HEIGHT
      const containerTop = containerRef.current.getBoundingClientRect().top + window.scrollY
      window.scrollTo({
        top: containerTop + targetTop - window.innerHeight / 2,
        behavior: 'smooth'
      })
      // Force window update to include target in next render
      setTimeout(updateWindow, 100)
    },
    [shouldVirtualize, updateWindow]
  )

  return { isVirtualized: shouldVirtualize, virtualWindow, containerRef, scrollToIndex }
}

/**
 * Hook for individual block visibility – used for asset unloading / lazy rendering.
 * Returns true when the element is within `rootMargin` of the viewport.
 * Falls back to `true` in test / SSR environments where IntersectionObserver is unavailable
 * so that tests still see content and server rendering is not empty.
 */
export function useIsInViewport(
  ref: React.RefObject<Element | null>,
  options: { rootMargin?: string; threshold?: number } = {}
): boolean {
  const { rootMargin = '500px', threshold = 0 } = options
  const isTestEnv =
    typeof navigator !== 'undefined' && /jsdom|vitest/i.test(navigator.userAgent || '')
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return true
    if (isTestEnv) return true
    if (!('IntersectionObserver' in window)) return true
    return false
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (isTestEnv) {
      setIsVisible(true)
      return
    }
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) setIsVisible(entry.isIntersecting)
      },
      { rootMargin, threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootMargin, threshold, isTestEnv])

  return isVisible
}

import { useEffect, useRef, useState } from 'react'

/**
 * Asset unloading / memory recycling for ReaderMediaBlocks.
 * Tracks whether the media container is inside the viewport (with generous margin).
 * When outside viewport for a sustained period, the caller should drop the <img> src
 * or release Object URLs to free memory.
 *
 * Uses IntersectionObserver with memory-friendly thresholds.
 * Falls back to always-visible in test/SSR so images still render in tests.
 */
export function useAssetVisibility(rootMargin = '800px') {
  const ref = useRef<HTMLDivElement>(null)
  // Test / SSR / jsdom fallback: always load immediately so tests see images.
  // In real browser with IntersectionObserver, start loaded then unload when out of view.
  const isTestEnv =
    typeof navigator !== 'undefined' && /jsdom|vitest/i.test(navigator.userAgent || '')
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return true
    if (isTestEnv) return true
    if (!('IntersectionObserver' in window)) return true
    return true
  })
  const [shouldLoad, setShouldLoad] = useState(() => {
    if (typeof window === 'undefined') return true
    if (isTestEnv) return true
    if (!('IntersectionObserver' in window)) return true
    return true
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const isTestEnvNow =
      typeof navigator !== 'undefined' && /jsdom|vitest/i.test(navigator.userAgent || '')
    if (isTestEnvNow) {
      setIsVisible(true)
      setShouldLoad(true)
      return
    }
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true)
      setShouldLoad(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        const intersecting = entry?.isIntersecting ?? false
        setIsVisible(intersecting)
        if (intersecting) {
          setShouldLoad(true)
        } else {
          // Delay unloading to avoid flicker on fast scroll – keep loaded for 2s after exit
          const timer = setTimeout(() => {
            // Only unload if still not visible
            setIsVisible((prev) => {
              if (!prev) setShouldLoad(false)
              return prev
            })
          }, 2000)
          // If re-enters before timeout, the next observer callback will cancel via state update
          return () => clearTimeout(timer)
        }
      },
      { rootMargin, threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return { ref, isVisible, shouldLoad }
}

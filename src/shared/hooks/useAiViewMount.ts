import { useEffect, useState } from 'react'

export function useAiSurfaceMount() {
  const [isAiSurfaceMounted, setIsAiSurfaceMounted] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }

    const mountSurface = () => {
      if (!cancelled) setIsAiSurfaceMounted(true)
    }

    if (browserWindow.requestIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(mountSurface, { timeout: 300 })
      return () => {
        cancelled = true
        browserWindow.cancelIdleCallback?.(idleId)
      }
    }

    const timeoutId = globalThis.setTimeout(mountSurface, 120)
    return () => {
      cancelled = true
      globalThis.clearTimeout(timeoutId)
    }
  }, [])

  return isAiSurfaceMounted
}

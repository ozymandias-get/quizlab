import { useCallback, useEffect, useRef, useState } from 'react'
import { Logger } from '@shared/lib/logger'

function scheduleIdlePrefetch(prefetch: () => Promise<unknown>) {
  if (
    typeof window !== 'undefined' &&
    typeof window.requestIdleCallback === 'function' &&
    typeof window.cancelIdleCallback === 'function'
  ) {
    const handle = window.requestIdleCallback(
      () => {
        void prefetch().catch((error) => Logger.error('Error prefetching SettingsModal:', error))
      },
      { timeout: 2000 }
    )

    return () => window.cancelIdleCallback(handle)
  }

  const timer = window.setTimeout(() => {
    void prefetch().catch((error) => Logger.error('Error prefetching SettingsModal:', error))
  }, 1500)

  return () => window.clearTimeout(timer)
}

export function useBottomBarController(isTourActive: boolean) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState('prompts')
  const [isAnimating, setIsAnimating] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pointerStart = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (isTourActive) {
      setIsOpen(true)
    }
  }, [isTourActive])

  useEffect(() => scheduleIdlePrefetch(() => import('@features/settings')), [])

  useEffect(
    () => () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
    },
    []
  )

  const handleToggle = useCallback(
    (event?: React.MouseEvent) => {
      if (isAnimating) {
        event?.stopPropagation()
        return
      }

      setIsAnimating(true)
      setIsOpen((prev) => !prev)

      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }

      animationTimeoutRef.current = setTimeout(() => setIsAnimating(false), 400)
    },
    [isAnimating]
  )

  const handleHubPointerDown = useCallback((event: React.PointerEvent) => {
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }, [])

  const handleHubPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const dx = Math.abs(event.clientX - pointerStart.current.x)
      const dy = Math.abs(event.clientY - pointerStart.current.y)

      if (dx < 5 && dy < 5) {
        handleToggle(event as unknown as React.MouseEvent)
      }
    },
    [handleToggle]
  )

  const openSettings = useCallback((initialTab: string) => {
    setSettingsInitialTab(initialTab)
    setIsSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  return {
    barRef,
    isOpen,
    isSettingsOpen,
    settingsInitialTab,
    handleToggle,
    handleHubPointerDown,
    handleHubPointerUp,
    openSettings,
    closeSettings,
    setIsOpen
  }
}

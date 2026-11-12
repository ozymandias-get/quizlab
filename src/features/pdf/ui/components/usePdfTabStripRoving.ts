import { useCallback, useRef } from 'react'

interface UsePdfTabStripRovingOptions<T extends { id: string }> {
  visibleTabs: T[]
  activeTabId: string
  onSetActiveTab: (tabId: string) => void
}

/**
 * WAI-ARIA tabs roving tabindex: the active tab is the single tab stop and
 * ArrowLeft/ArrowRight/Home/End move focus and activation along the strip.
 */
export function usePdfTabStripRoving<T extends { id: string }>({
  visibleTabs,
  activeTabId,
  onSetActiveTab
}: UsePdfTabStripRovingOptions<T>) {
  const tabButtonRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())
  const setTabButtonRef = useCallback((el: HTMLButtonElement | null, tabId: string) => {
    tabButtonRefs.current.set(tabId, el)
  }, [])

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key !== 'ArrowLeft' &&
        event.key !== 'ArrowRight' &&
        event.key !== 'Home' &&
        event.key !== 'End'
      ) {
        return
      }
      // Arrow keys stay inside the strip and only move tab focus.
      if (visibleTabs.length === 0) return
      event.preventDefault()

      const currentIndex = visibleTabs.findIndex((tab) => tab.id === activeTabId)
      let nextIndex: number
      if (event.key === 'Home') {
        nextIndex = 0
      } else if (event.key === 'End') {
        nextIndex = visibleTabs.length - 1
      } else {
        const step = event.key === 'ArrowRight' ? 1 : -1
        nextIndex = Math.max(0, Math.min(visibleTabs.length - 1, currentIndex + step))
      }

      const nextTab = visibleTabs[nextIndex]
      if (!nextTab) return
      onSetActiveTab(nextTab.id)
      tabButtonRefs.current.get(nextTab.id)?.focus()
    },
    [visibleTabs, activeTabId, onSetActiveTab]
  )

  return { setTabButtonRef, handleRowKeyDown }
}

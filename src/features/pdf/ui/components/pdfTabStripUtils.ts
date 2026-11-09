import type { PdfTab } from '@features/pdf/hooks/types'

export interface ContextMenuState {
  tabId: string
  x: number
  y: number
}

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const MIN_TAB_WIDTH = 140
const HOME_BUTTON_WIDTH = 32
const ADD_BUTTON_WIDTH = 32
const OVERFLOW_BUTTON_WIDTH = 44

export function getMaxVisibleTabs(containerWidth: number, hasHome: boolean): number {
  const reservedButtons =
    (hasHome ? HOME_BUTTON_WIDTH : 0) + ADD_BUTTON_WIDTH + OVERFLOW_BUTTON_WIDTH
  const gapCount = 2
  const gapsWidth = gapCount * 8
  const available = containerWidth - reservedButtons - gapsWidth
  // Below one pill's minimum width, showing a pill would push the add/overflow
  // controls out of the row. Return 0 so every tab moves into the overflow
  // menu instead.
  return Math.max(0, Math.floor(available / MIN_TAB_WIDTH))
}

export interface TabVisibilityResult {
  visibleTabs: PdfTab[]
  overflowTabs: PdfTab[]
}

export function computeTabVisibility(
  tabs: PdfTab[],
  activeTabId: string,
  maxVisibleTabs: number
): TabVisibilityResult {
  const visibleTabIds = (() => {
    if (!tabs) return new Set<string>()
    const max = maxVisibleTabs
    if (tabs.length <= max) {
      return new Set(tabs.map((tab) => tab.id))
    }
    const activeIndex = Math.max(
      0,
      tabs.findIndex((tab) => tab.id === activeTabId)
    )
    const half = Math.floor((max - 1) / 2)
    // Shift the window at either end so it always fills the measured capacity.
    const start = Math.min(Math.max(0, tabs.length - max), Math.max(0, activeIndex - half))
    return new Set(tabs.slice(start, start + max).map((tab) => tab.id))
  })()

  const nextVisibleTabs: PdfTab[] = []
  const nextOverflowTabs: PdfTab[] = []

  for (const tab of tabs) {
    if (visibleTabIds.has(tab.id)) {
      nextVisibleTabs.push(tab)
      continue
    }
    nextOverflowTabs.push(tab)
  }

  return { visibleTabs: nextVisibleTabs, overflowTabs: nextOverflowTabs }
}

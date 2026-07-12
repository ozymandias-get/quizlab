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
  return Math.max(1, Math.floor(available / MIN_TAB_WIDTH))
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
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId)
    if (activeIndex <= 0) {
      return new Set(tabs.slice(0, max).map((tab) => tab.id))
    }
    if (activeIndex >= tabs.length - 1) {
      return new Set(tabs.slice(-max).map((tab) => tab.id))
    }
    const half = Math.floor((max - 1) / 2)
    const start = Math.max(0, activeIndex - half)
    const end = Math.min(tabs.length, start + max)
    return new Set(tabs.slice(start, end).map((tab) => tab.id))
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

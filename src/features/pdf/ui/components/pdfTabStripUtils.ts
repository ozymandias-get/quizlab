import type { PdfTab } from '@features/pdf/hooks/types'

export interface ContextMenuState {
  tabId: string
  x: number
  y: number
}

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const MIN_TAB_WIDTH = 140
/** The PDF pill's own max width; long file names are ellipsized at this size. */
export const PDF_TAB_MAX_WIDTH = 240
export const PDF_TAB_GAP = 8
const HOME_BUTTON_WIDTH = 32
const ADD_BUTTON_WIDTH = 32
const OVERFLOW_BUTTON_WIDTH = 44

export interface PdfTabStripCapacity {
  /** The overflow button only exists while at least one tab is hidden. */
  hasOverflow?: boolean
}

/** Width spent on controls and gaps before any tab pill. */
export function getPdfTabStripChromeWidth(hasHome: boolean, hasOverflow = true): number {
  return (
    (hasHome ? HOME_BUTTON_WIDTH : 0) +
    ADD_BUTTON_WIDTH +
    (hasOverflow ? OVERFLOW_BUTTON_WIDTH : 0) +
    16
  )
}

export function getMaxVisibleTabs(
  containerWidth: number,
  hasHome: boolean,
  { hasOverflow = true }: PdfTabStripCapacity = {}
): number {
  const available = containerWidth - getPdfTabStripChromeWidth(hasHome, hasOverflow)
  // Below one pill's minimum width, showing a pill would push the add/overflow
  // controls out of the row. Return 0 so every tab moves into the overflow
  // menu instead.
  return Math.max(0, Math.floor(available / MIN_TAB_WIDTH))
}

/** Width one pill wants after layout, capped at the pill's own max width. */
export function getDesiredPdfTabWidth(renderedWidth: number, clippedText: number): number {
  return Math.min(PDF_TAB_MAX_WIDTH, Math.max(0, renderedWidth + clippedText))
}

export interface PdfTabCapacityInput {
  current: number
  tabWidths: readonly number[]
  availableWidth: number
  hasOverflow: boolean
}

/** Same measured correction rules as the AI strip. */
export function resolveVisiblePdfTabCount({
  current,
  tabWidths,
  availableWidth,
  hasOverflow
}: PdfTabCapacityInput): number {
  const required =
    tabWidths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, tabWidths.length - 1) * PDF_TAB_GAP

  if (required > availableWidth) return Math.max(0, current - 1)

  if (hasOverflow && availableWidth - required >= PDF_TAB_MAX_WIDTH + PDF_TAB_GAP) {
    return current + 1
  }

  return current
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

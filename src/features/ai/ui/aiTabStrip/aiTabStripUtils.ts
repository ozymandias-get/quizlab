import type { Tab } from '@app/providers/ai-context'

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

/** Smallest comfortable AI tab pill; used to derive how many fit. */
const MIN_TAB_WIDTH = 132
/** The pill's own max width; a long label is ellipsized, never widened past this. */
export const AI_TAB_MAX_WIDTH = 240
export const AI_TAB_GAP = 6
const HOME_BUTTON_WIDTH = 32
const REFRESH_BUTTON_WIDTH = 32
const DIVIDER_WIDTH = 1
const OVERFLOW_BUTTON_WIDTH = 44
const ROW_GAP = 6

export interface AiTabStripCapacity {
  hasHome?: boolean
  hasRefresh?: boolean
}

/** Width the strip spends on controls and gaps before any tab pill. */
export function getAiTabStripChromeWidth({
  hasHome = false,
  hasRefresh = false
}: AiTabStripCapacity = {}): number {
  return (
    (hasHome ? HOME_BUTTON_WIDTH : 0) +
    (hasRefresh ? REFRESH_BUTTON_WIDTH : 0) +
    DIVIDER_WIDTH +
    OVERFLOW_BUTTON_WIDTH +
    // Home/refresh/divider before the pills, overflow after them.
    4 * ROW_GAP
  )
}

/**
 * Initial number of tab pills that fit, based on the smallest comfortable
 * pill. The hook refines this downwards with the real rendered widths, so a
 * long label never relies on this estimate alone.
 *
 * The strip used to always show three tabs, which left dead space on wide
 * windows and clipped pills in a narrow split pane. The count now follows the
 * measured container width, mirroring the PDF strip.
 */
export function getMaxVisibleAiTabs(
  containerWidth: number,
  capacity: AiTabStripCapacity = {}
): number {
  if (containerWidth <= 0) return 3

  const available = containerWidth - getAiTabStripChromeWidth(capacity)
  return Math.max(0, Math.floor(available / MIN_TAB_WIDTH))
}

/**
 * Width one pill wants after layout, capped at the pill's own max width.
 * A truncated label reports its full text width, but the pill never grows past
 * `AI_TAB_MAX_WIDTH`; without this cap a single long title could be treated as
 * wider than the whole strip and hide itself.
 */
export function getDesiredAiTabWidth(renderedWidth: number, clippedText: number): number {
  return Math.min(AI_TAB_MAX_WIDTH, Math.max(0, renderedWidth + clippedText))
}

export interface AiTabCapacityInput {
  current: number
  tabWidths: readonly number[]
  availableWidth: number
  hasOverflow: boolean
}

/**
 * Decides whether the measured pills need one fewer slot, or whether there is
 * room to bring one back from the overflow menu.
 *
 * Increases use the pill's maximum width, not the measured average, so a wider
 * incoming tab cannot immediately force another decrease and oscillate.
 */
export function resolveVisibleAiTabCount({
  current,
  tabWidths,
  availableWidth,
  hasOverflow
}: AiTabCapacityInput): number {
  const required =
    tabWidths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, tabWidths.length - 1) * AI_TAB_GAP

  if (required > availableWidth) return Math.max(0, current - 1)

  if (hasOverflow && availableWidth - required >= AI_TAB_MAX_WIDTH + AI_TAB_GAP) {
    return current + 1
  }

  return current
}

/**
 * Returns the set of tab ids that should be rendered in the tab strip.
 * The active tab is kept visible together with its neighbours; when the active
 * tab sits at either end the window is shifted so it still fills the capacity.
 */
export function getVisibleTabIds(
  tabs: Tab[] = [],
  activeTabId: string,
  maxVisibleTabs = 3
): Set<string> {
  const max = Math.max(0, maxVisibleTabs)
  if (max === 0) return new Set()
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
}

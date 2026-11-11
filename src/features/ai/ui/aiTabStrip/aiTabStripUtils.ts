import type { Tab } from '@app/providers/ai-context'

/** Smallest comfortable AI tab pill; used to derive how many fit. */
export const AI_TAB_MIN_WIDTH = 132
/** The pill's own max width; a long label is ellipsized, never widened past this. */
export const AI_TAB_MAX_WIDTH = 240
const AI_TAB_GAP = 6
const HOME_BUTTON_WIDTH = 32
const REFRESH_BUTTON_WIDTH = 32
const DIVIDER_WIDTH = 1
const OVERFLOW_BUTTON_WIDTH = 44
const ROW_GAP = 6

interface AiTabStripCapacity {
  hasHome?: boolean
  hasRefresh?: boolean
  /** The overflow button only exists while at least one tab is hidden. */
  hasOverflow?: boolean
}

/** Width the strip spends on controls and gaps before any tab pill. */
export function getAiTabStripChromeWidth({
  hasHome = false,
  hasRefresh = false,
  hasOverflow = true
}: AiTabStripCapacity = {}): number {
  return (
    (hasHome ? HOME_BUTTON_WIDTH : 0) +
    (hasRefresh ? REFRESH_BUTTON_WIDTH : 0) +
    DIVIDER_WIDTH +
    (hasOverflow ? OVERFLOW_BUTTON_WIDTH : 0) +
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
  return Math.max(0, Math.floor(available / AI_TAB_MIN_WIDTH))
}

/**
 * Width-based estimate that reserves the overflow button only when the tab
 * list actually exceeds the roomier no-overflow estimate.
 */
export function getInitialVisibleAiTabs(
  containerWidth: number,
  tabCount: number,
  capacity: Omit<AiTabStripCapacity, 'hasOverflow'> = {}
): number {
  const withoutOverflow = getMaxVisibleAiTabs(containerWidth, { ...capacity, hasOverflow: false })
  return tabCount > withoutOverflow
    ? getMaxVisibleAiTabs(containerWidth, { ...capacity, hasOverflow: true })
    : withoutOverflow
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

interface AiTabCapacityInput {
  current: number
  tabWidths: readonly number[]
  availableWidth: number
  hasOverflow: boolean
  /**
   * Expected width of the tab that would return from overflow. Defaults to the
   * pill maximum; the hook passes the widest measured pill so short tabs are
   * not kept hidden by the 240px worst case.
   */
  incrementReserveWidth?: number
}

/**
 * Decides whether the measured pills need one fewer slot, or whether there is
 * room to bring one back from the overflow menu.
 *
 * Increases use the widest currently measured pill as a reserve, so short tabs
 * are not kept hidden by the 240px worst case. The hook blocks an immediate
 * re-increase after a failed attempt to prevent oscillation.
 */
export function resolveVisibleAiTabCount({
  current,
  tabWidths,
  availableWidth,
  hasOverflow,
  incrementReserveWidth = AI_TAB_MAX_WIDTH
}: AiTabCapacityInput): number {
  const required =
    tabWidths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, tabWidths.length - 1) * AI_TAB_GAP

  if (required > availableWidth) return Math.max(0, current - 1)

  const reserve = Math.max(AI_TAB_MIN_WIDTH, Math.min(AI_TAB_MAX_WIDTH, incrementReserveWidth))
  if (hasOverflow && availableWidth - required >= reserve + AI_TAB_GAP) {
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

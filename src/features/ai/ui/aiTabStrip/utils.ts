import type { Tab } from '@app/providers/AiContext'

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

/**
 * Returns the set of tab ids that should be rendered in the tab strip.
 * For lists with up to 3 tabs, all are visible. For longer lists, the active
 * tab is shown together with its immediate neighbors (or the first/last 3
 * when the active tab is at either end).
 */
export const getVisibleTabIds = (tabs: Tab[] = [], activeTabId: string): Set<string> => {
  if (tabs.length <= 3) {
    return new Set(tabs.map((tab) => tab.id))
  }

  const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId)
  const lastIndex = tabs.length - 1

  if (activeIndex <= 0) {
    return new Set([tabs[0].id, tabs[1].id, tabs[2].id])
  }
  if (activeIndex >= lastIndex) {
    return new Set([tabs[lastIndex - 2].id, tabs[lastIndex - 1].id, tabs[lastIndex].id])
  }

  return new Set([tabs[activeIndex - 1].id, tabs[activeIndex].id, tabs[activeIndex + 1].id])
}

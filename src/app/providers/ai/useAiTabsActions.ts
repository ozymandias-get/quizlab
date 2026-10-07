import type { PinnedTabStorage, Tab } from './types'

export function updateTabsWithModel(tabs: Tab[], currentTabId: string, modelId: string): Tab[] {
  return tabs.map((tab) => (tab.id === currentTabId ? { ...tab, modelId } : tab))
}

export function updatePinnedTabsWithModel(
  pinnedTabs: PinnedTabStorage[],
  currentTabId: string,
  modelId: string
): PinnedTabStorage[] {
  if (!pinnedTabs.some((tab) => tab.id === currentTabId)) return pinnedTabs
  return pinnedTabs.map((tab) => (tab.id === currentTabId ? { ...tab, modelId } : tab))
}

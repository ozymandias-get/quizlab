import { normalizeTitle } from './tabUtils'
import type { PinnedTabStorage, SetStoredValue, Tab } from './types'

export function setCurrentAIImpl(
  id: string,
  activeTabIdRef: React.MutableRefObject<string>,
  setPinnedTabs: SetStoredValue<PinnedTabStorage[]>
) {
  return (prev: Tab[]) => {
    const currentTabId = activeTabIdRef.current
    const activeTab = prev.find((tab) => tab.id === currentTabId)
    if (!activeTab) return prev

    const nextTabs = prev.map((tab) => (tab.id === currentTabId ? { ...tab, modelId: id } : tab))

    if (activeTab.pinned) {
      setPinnedTabs((prevPinnedTabs) =>
        prevPinnedTabs.map((tab) =>
          tab.id === currentTabId
            ? { ...tab, modelId: id, title: normalizeTitle(activeTab.title) }
            : tab
        )
      )
    }

    return nextTabs
  }
}

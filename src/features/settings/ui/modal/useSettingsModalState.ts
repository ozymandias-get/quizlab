import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { buildSettingsSidebarSections, buildSettingsTabDefs } from './settingsModalTabs'
import { type SettingsTabId, type TabDef, toSettingsTabId } from './settingsTabDefinitions'

interface UseSettingsModalStateOptions {
  isOpen: boolean
  initialTab?: string
}

export function useSettingsModalState({ isOpen, initialTab }: UseSettingsModalStateOptions) {
  const { t } = useTranslation()
  const sidebarScrollRef = useRef<HTMLDivElement>(null)
  const [activeTabState, setActiveTabState] = useState<SettingsTabId | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const initialTabId = initialTab ? toSettingsTabId(initialTab) : null
    setActiveTabState(initialTabId)

    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTop = 0
    }
  }, [isOpen, initialTab])

  const tabDefs = useMemo(() => buildSettingsTabDefs(t), [t])
  const sidebarSections = useMemo(() => buildSettingsSidebarSections(t), [t])

  const activeTabMeta = useMemo<TabDef | null>(() => {
    if (!activeTabState) return null
    return tabDefs.find((tab) => tab.id === activeTabState) ?? null
  }, [activeTabState, tabDefs])

  const setActiveTab = useCallback((value: string) => {
    const id = toSettingsTabId(value)
    if (id) {
      setActiveTabState(id)
    }
  }, [])

  return {
    activeTab: activeTabState,
    activeTabMeta,
    setActiveTab,
    sidebarScrollRef,
    sidebarSections
  }
}

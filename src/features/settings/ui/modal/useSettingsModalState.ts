import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  buildSettingsSidebarSections,
  buildSettingsTabDefs,
  type SettingsTabId,
  type TabDef,
  toSettingsTabId
} from './settingsModalTabs'

interface UseSettingsModalStateOptions {
  initialTab?: string
  isOpen: boolean
  onClose: () => void
}

export function useSettingsModalState({
  initialTab,
  isOpen,
  onClose
}: UseSettingsModalStateOptions) {
  const { t } = useTranslation()
  const sidebarScrollRef = useRef<HTMLDivElement>(null)
  const normalizedInitialTab = toSettingsTabId(initialTab)
  const [activeTabState, setActiveTabState] = useState<SettingsTabId | null>(normalizedInitialTab)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    setActiveTabState(normalizedInitialTab)

    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTop = 0
    }
  }, [isOpen, normalizedInitialTab])

  const tabDefs = useMemo(() => buildSettingsTabDefs(t), [t])
  const sidebarSections = useMemo(() => buildSettingsSidebarSections(t), [t])

  const activeTabMeta = useMemo<TabDef | null>(() => {
    if (!activeTabState) return null
    return tabDefs.find((tab) => tab.id === activeTabState) ?? null
  }, [activeTabState, tabDefs])

  const setActiveTab = useCallback((value: string) => {
    const id = toSettingsTabId(value)
    setActiveTabState(id)
  }, [])

  return {
    activeTab: activeTabState,
    activeTabMeta,
    setActiveTab,
    sidebarScrollRef,
    sidebarSections,
    t
  }
}

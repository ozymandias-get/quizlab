import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSettings } from '../../hooks/useSettings'
import {
  buildSettingsSidebarSections,
  buildSettingsTabDefs,
  QUICK_SETTINGS_GROUP,
  type SettingsTabGroup,
  type SettingsTabId,
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
  // eslint-disable-next-line react/hook-use-state
  const [activeTab, setActiveTabState] = useState<SettingsTabId>(normalizedInitialTab)
  const [selectedGroup, setSelectedGroup] = useState<SettingsTabGroup | null>(QUICK_SETTINGS_GROUP)
  const [isOverviewMode, setIsOverviewMode] = useState(true)
  const settings = useSettings()

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

    setActiveTab(normalizedInitialTab)
    setSelectedGroup(QUICK_SETTINGS_GROUP)
    setIsOverviewMode(true)

    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTop = 0
    }
  }, [isOpen, normalizedInitialTab])

  const tabDefs = useMemo(() => buildSettingsTabDefs(t), [t])
  const sidebarSections = useMemo(() => buildSettingsSidebarSections(t), [t])
  const activeTabMeta = useMemo(
    () => tabDefs.find((tab) => tab.id === activeTab) ?? tabDefs[0],
    [tabDefs, activeTab]
  )

  const setActiveTab = useCallback(
    (value: string) => {
      const id = toSettingsTabId(value)
      setActiveTabState(id)
      setIsOverviewMode(false)

      const meta = tabDefs.find((tab) => tab.id === id)
      if (meta) {
        setSelectedGroup(meta.group as SettingsTabGroup)
      }
    },
    [tabDefs]
  )

  const selectGroup = useCallback((group: SettingsTabGroup) => {
    setSelectedGroup(group)
    setIsOverviewMode(true)
  }, [])

  return {
    activeTab,
    activeTabMeta,
    selectedGroup,
    isOverviewMode,
    setActiveTab,
    selectGroup,
    settings,
    sidebarScrollRef,
    sidebarSections,
    t,
    tabDefs
  }
}

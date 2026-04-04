import { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguageStrings } from '@app/providers'
import { useSettings } from '../../hooks/useSettings'
import { buildSettingsTabDefs, toSettingsTabId, type SettingsTabId } from './settingsModalTabs'

const CLICK_OUTSIDE_DELAY = 100

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
  const { t } = useLanguageStrings()
  const modalRef = useRef<HTMLDivElement>(null)
  const sidebarScrollRef = useRef<HTMLDivElement>(null)
  const normalizedInitialTab = toSettingsTabId(initialTab)
  const [activeTab, setActiveTab] = useState<SettingsTabId>(normalizedInitialTab)
  const settings = useSettings()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    let timeout: ReturnType<typeof setTimeout> | null = null
    if (isOpen) {
      timeout = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, CLICK_OUTSIDE_DELAY)
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setActiveTab(normalizedInitialTab)
    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTop = 0
    }
  }, [isOpen, normalizedInitialTab])

  const tabDefs = useMemo(() => buildSettingsTabDefs(t), [t])
  const activeTabMeta = tabDefs.find((tab) => tab.id === activeTab) ?? tabDefs[0]

  return {
    activeTab,
    activeTabMeta,
    modalRef,
    setActiveTab: (value: string) => setActiveTab(toSettingsTabId(value)),
    settings,
    sidebarScrollRef,
    t,
    tabDefs
  }
}

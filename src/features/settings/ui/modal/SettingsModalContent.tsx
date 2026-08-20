import { ScrollArea } from '@app/components/ui/scroll-area'
import { DURATION } from '@shared/lib/motion'
import { EmptyState, InlineSpinner } from '@shared/ui/components/primitives'
import { SettingsIcon } from '@ui/components/Icons'

import { AnimatePresence, motion } from 'motion/react'
import { memo, Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SETTINGS_TAB_COMPONENTS } from './settingsTabComponents'
import {
  SETTINGS_MODAL_MAIN_PANEL_ID,
  type SettingsTabId,
  type TabDef
} from './settingsTabDefinitions'

interface SettingsModalContentProps {
  activeTab: SettingsTabId | null
  activeTabMeta: TabDef | null
  onClose: () => void
  setActiveTab: (id: string) => void
}

const TabPanel = memo(function TabPanel({
  tabId,
  isActive,
  onClose,
  setActiveTab
}: {
  tabId: SettingsTabId
  isActive: boolean
  onClose: () => void
  setActiveTab: (id: string) => void
}) {
  const TabComponent = SETTINGS_TAB_COMPONENTS[tabId]
  return (
    <div
      role="presentation"
      inert={!isActive ? true : undefined}
      style={{ display: isActive ? 'block' : 'none' }}
    >
      {isActive && (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center p-12">
              <InlineSpinner size="lg" className="border-border border-t-foreground/50" />
            </div>
          }
        >
          <TabComponent onClose={onClose} setActiveTab={setActiveTab} />
        </Suspense>
      )}
    </div>
  )
})

export default memo(function SettingsModalContent({
  activeTab,
  activeTabMeta,
  onClose,
  setActiveTab
}: SettingsModalContentProps) {
  const { t } = useTranslation()
  const [visitedTabs, setVisitedTabs] = useState<Set<SettingsTabId>>(new Set())

  useEffect(() => {
    if (!activeTab) return
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  const visitedTabsList = useMemo(() => [...visitedTabs], [visitedTabs])

  return (
    <main
      id={SETTINGS_MODAL_MAIN_PANEL_ID}
      data-tour-id="tour-target-settings-modal"
      className="flex min-w-0 flex-1 flex-col overflow-hidden"
    >
      <ScrollArea className="min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-10">
        <AnimatePresence mode="wait">
          {!activeTab || !activeTabMeta ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.normal }}
              className="flex h-full min-h-[300px] items-center justify-center"
            >
              <EmptyState
                icon={SettingsIcon}
                title={t('select_setting_from_list')}
                bare
                size="sm"
              />
            </motion.div>
          ) : (
            <motion.div
              key={`tab-${activeTab}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.normal }}
            >
              {visitedTabsList.map((tabId) => (
                <TabPanel
                  key={tabId}
                  tabId={tabId}
                  isActive={activeTab === tabId}
                  onClose={onClose}
                  setActiveTab={setActiveTab}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </main>
  )
})

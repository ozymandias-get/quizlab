import { ScrollArea } from '@app/components/ui/scroll-area'

import { AnimatePresence, motion } from 'motion/react'
import { lazy, memo, Suspense, useEffect, useState } from 'react'

import {
  QUICK_SETTINGS_GROUP,
  SETTINGS_MODAL_MAIN_PANEL_ID,
  SETTINGS_TAB_COMPONENTS,
  type SettingsState,
  settingsTabButtonId,
  type SettingsTabGroup,
  type SettingsTabId,
  type TabDef
} from './settingsModalTabs'

interface SettingsModalContentProps {
  activeTab: SettingsTabId | null
  selectedGroup: SettingsTabGroup | null
  onClose: () => void
  settings: SettingsState
  t: (key: string) => string
  tabDefs: TabDef[]
}

export default memo(function SettingsModalContent({
  activeTab,
  selectedGroup,
  onClose,
  settings,
  t,
  tabDefs
}: SettingsModalContentProps) {
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

  const activeTabMeta = activeTab ? tabDefs.find((tab) => tab.id === activeTab) : null

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
              transition={{ duration: 0.12 }}
              className="flex h-full min-h-[300px] items-center justify-center"
            >
              <div className="text-center">
                <p className="text-muted-foreground/40 text-xs">
                  Select a setting from the list to configure
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`tab-${activeTab}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <div className="mb-5 space-y-0.5 px-1">
                <div className="text-muted-foreground/50 text-ql-10 font-semibold tracking-widest uppercase">
                  {activeTabMeta.group === QUICK_SETTINGS_GROUP
                    ? t('quick_settings')
                    : tabDefs.find((t) => t.group === activeTabMeta.group)?.group ?? ''}
                </div>
                <h3 className="text-foreground text-base font-semibold tracking-tight">
                  {activeTabMeta.label}
                </h3>
                <p className="text-muted-foreground text-xs tracking-wide">
                  {activeTabMeta.description}
                </p>
              </div>

              {[...visitedTabs].map((tabId) => {
                const isActive = activeTab === tabId
                const TabComponent = SETTINGS_TAB_COMPONENTS[tabId]
                return (
                  <div
                    key={tabId}
                    role="presentation"
                    inert={!isActive ? true : undefined}
                    style={{ display: isActive ? 'block' : 'none' }}
                  >
                    {isActive && (
                      <Suspense
                        fallback={
                          <div className="flex h-full items-center justify-center p-12">
                            <div className="border-border border-t-foreground/50 h-5 w-5 animate-spin rounded-full border-2" />
                          </div>
                        }
                      >
                        <TabComponent onClose={onClose} settings={settings} t={t} />
                      </Suspense>
                    )}
                  </div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </main>
  )
})

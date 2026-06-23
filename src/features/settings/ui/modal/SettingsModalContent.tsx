import { ScrollArea } from '@app/components/ui/scroll-area'

import { ChevronLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { lazy, memo, Suspense, useCallback, useEffect, useState } from 'react'

import {
  QUICK_SETTINGS_GROUP,
  SETTINGS_MODAL_MAIN_PANEL_ID,
  SETTINGS_TAB_COMPONENTS,
  type SettingsSidebarSection,
  type SettingsState,
  settingsTabButtonId,
  type SettingsTabGroup,
  type SettingsTabId,
  type TabDef
} from './settingsModalTabs'
import SettingsOverview from './SettingsOverview'

const QuickSettings = lazy(() => import('../QuickSettings'))

interface SettingsModalContentProps {
  activeTab: SettingsTabId
  selectedGroup: SettingsTabGroup | null
  isOverviewMode: boolean
  onClose: () => void
  settings: SettingsState
  t: (key: string) => string
  tabDefs: TabDef[]
  sidebarSections: SettingsSidebarSection[]
  setActiveTab: (id: string) => void
  selectGroup: (group: SettingsTabGroup) => void
}

export default memo(function SettingsModalContent({
  activeTab,
  selectedGroup,
  isOverviewMode,
  onClose,
  settings,
  t,
  tabDefs,
  sidebarSections,
  setActiveTab,
  selectGroup
}: SettingsModalContentProps) {
  const [visitedTabs, setVisitedTabs] = useState<Set<SettingsTabId>>(new Set([activeTab]))

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  const activeTabMeta = tabDefs.find((tab) => tab.id === activeTab)
  const activeSection = sidebarSections.find((s) => s.id === selectedGroup)
  const isQuickSettings = selectedGroup === QUICK_SETTINGS_GROUP

  const handleBackToOverview = useCallback(() => {
    if (selectedGroup) {
      selectGroup(selectedGroup)
    }
  }, [selectedGroup, selectGroup])

  return (
    <main
      id={SETTINGS_MODAL_MAIN_PANEL_ID}
      data-tour-id="tour-target-settings-modal"
      role="tabpanel"
      aria-labelledby={settingsTabButtonId(activeTab)}
      className="flex min-w-0 flex-1 flex-col overflow-hidden"
    >
      <ScrollArea className="min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-10">
        <AnimatePresence mode="wait">
          {isQuickSettings ? (
            <motion.div
              key="quick-settings"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <Suspense
                fallback={
                  <div className="flex items-center justify-center p-12">
                    <div className="border-border border-t-foreground/50 h-5 w-5 animate-spin rounded-full border-2" />
                  </div>
                }
              >
                <QuickSettings t={t} setActiveTab={setActiveTab} />
              </Suspense>
            </motion.div>
          ) : isOverviewMode && activeSection ? (
            <motion.div
              key={`overview-${selectedGroup}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <SettingsOverview section={activeSection} setActiveTab={setActiveTab} t={t} />
            </motion.div>
          ) : (
            <motion.div
              key={`tab-${activeTab}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              {activeSection && (
                <button
                  type="button"
                  onClick={handleBackToOverview}
                  className="group border-border bg-card text-muted-foreground hover:border-ring/30 hover:bg-accent hover:text-foreground/80 focus-visible:ring-ring focus-visible:ring-offset-background mb-5 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <ChevronLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
                  {activeSection.label}
                </button>
              )}

              <div className="mb-5 space-y-1 px-1">
                <h3 className="text-foreground text-base font-semibold tracking-tight">
                  {activeTabMeta?.label}
                </h3>
                <p className="text-muted-foreground text-xs tracking-wide">
                  {activeTabMeta?.description}
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

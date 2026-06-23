import { hexToRgba } from '@shared/lib/uiUtils'
import { ScrollArea } from '@app/components/ui/scroll-area'

import { AnimatePresence, motion } from 'motion/react'
import { lazy, memo, Suspense } from 'react'

import {
  QUICK_SETTINGS_GROUP,
  type SettingsSidebarSection,
  type SettingsTabGroup,
  type SettingsTabId
} from './settingsModalTabs'

const QuickSettings = lazy(() => import('../QuickSettings'))

interface SettingsListPanelProps {
  selectedGroup: SettingsTabGroup | null
  activeTab: SettingsTabId | null
  sidebarSections: SettingsSidebarSection[]
  setActiveTab: (id: string) => void
  t: (key: string) => string
}

const SettingsListPanel = memo(function SettingsListPanel({
  selectedGroup,
  activeTab,
  sidebarSections,
  setActiveTab,
  t
}: SettingsListPanelProps) {
  const isQuickSettings = selectedGroup === QUICK_SETTINGS_GROUP
  const activeSection = sidebarSections.find((s) => s.id === selectedGroup)

  return (
    <div className="border-border relative flex w-[260px] shrink-0 flex-col border-r max-[1100px]:hidden">
      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        <AnimatePresence mode="wait">
          {isQuickSettings ? (
            <motion.div
              key="quick-settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <div className="mb-3 px-1">
                <div className="text-muted-foreground text-ql-10 font-semibold tracking-widest uppercase">
                  {t('quick_settings')}
                </div>
              </div>
              <Suspense
                fallback={
                  <div className="flex items-center justify-center p-8">
                    <div className="border-border border-t-foreground/50 h-5 w-5 animate-spin rounded-full border-2" />
                  </div>
                }
              >
                <QuickSettings t={t} setActiveTab={setActiveTab} />
              </Suspense>
            </motion.div>
          ) : activeSection ? (
            <motion.div
              key={`list-${selectedGroup}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="text-muted-foreground text-ql-10 font-semibold tracking-widest uppercase">
                  {activeSection.label}
                  <span className="text-muted-foreground/50 ml-1.5 font-normal">
                    · {activeSection.tabs.length}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {activeSection.tabs.map((tab) => {
                  const isSelected = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`group focus-visible:ring-ring focus-visible:ring-offset-background relative flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                        isSelected
                          ? 'border-ring/30 bg-accent'
                          : 'border-border hover:border-border hover:bg-accent/50 bg-transparent'
                      }`}
                      style={
                        isSelected
                          ? {
                              background: `linear-gradient(145deg, ${hexToRgba(tab.glow, 0.08)} 0%, rgba(255,255,255,0.03) 42%, rgba(0,0,0,0.1) 100%)`
                            }
                          : undefined
                      }
                    >
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: tab.glow }}
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-medium leading-tight transition-colors ${
                            isSelected
                              ? 'text-foreground'
                              : 'text-muted-foreground group-hover:text-foreground/70'
                          }`}
                        >
                          {tab.label}
                        </div>
                        {tab.description && (
                          <div className="text-muted-foreground/60 mt-0.5 truncate text-[11px] leading-tight">
                            {tab.description}
                          </div>
                        )}
                      </div>
                      <span className="text-muted-foreground/30 text-xs">›</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </ScrollArea>
    </div>
  )
})

export default SettingsListPanel

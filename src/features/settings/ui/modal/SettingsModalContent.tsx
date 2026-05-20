import { Suspense, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@ui/components/button'
import { CloseIcon } from '@ui/components/Icons'
import { useAppearance } from '@app/providers'
import {
  SETTINGS_MODAL_MAIN_PANEL_ID,
  SETTINGS_TAB_RENDERERS,
  settingsTabButtonId,
  type SettingsState,
  type SettingsTabId,
  type TabDef
} from './settingsModalTabs'

interface SettingsModalContentProps {
  activeTab: SettingsTabId
  onClose: () => void
  settings: SettingsState
  t: (key: string) => string
  tabDefs: TabDef[]
}

export default function SettingsModalContent({
  activeTab,
  onClose,
  settings,
  t,
  tabDefs
}: SettingsModalContentProps) {
  const performanceMode = useAppearance((s) => s.performanceMode)
  const activeTabLabel = tabDefs.find((tab) => tab.id === activeTab)?.label

  // Visited tabs set to lazy-load and keep loaded tabs in memory
  const [visitedTabs, setVisitedTabs] = useState<Set<SettingsTabId>>(new Set([activeTab]))

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  return (
    <main className="relative flex-1 flex flex-col min-w-0 bg-gradient-to-b from-white/[0.01] to-transparent">
      <header className="flex items-center justify-between px-6 md:px-8 pt-6 md:pt-8 pb-4">
        <div className="space-y-0.5">
          <AnimatePresence mode="wait">
            <motion.h3
              key={activeTab}
              initial={performanceMode ? { opacity: 0 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={performanceMode ? { opacity: 0 } : { opacity: 0, y: 6 }}
              transition={performanceMode ? { duration: 0.1 } : { duration: 0.2 }}
              className="text-ql-16 font-semibold text-white/90 tracking-tight"
            >
              {activeTabLabel}
            </motion.h3>
          </AnimatePresence>
          <p className="text-ql-11 font-medium tracking-ql-fine text-white/36">
            {t('configure_settings')}
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="glass-tier-3 glass-interactive group h-9 w-9 rounded-xl border-white/[0.1] bg-transparent transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <CloseIcon className="w-4 h-4 text-white/35 group-hover:text-white/80 transition-colors" />
        </Button>
      </header>

      <div className="mx-6 md:mx-8 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      <div
        id={SETTINGS_MODAL_MAIN_PANEL_ID}
        role="tabpanel"
        aria-labelledby={settingsTabButtonId(activeTab)}
        className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-8 py-5 md:py-6"
      >
        {[...visitedTabs].map((tabId) => {
          const isActive = activeTab === tabId
          return (
            <div
              key={tabId}
              className={isActive ? 'block' : 'hidden'}
              style={{ display: isActive ? 'block' : 'none' }}
            >
              <Suspense
                fallback={
                  <div className="flex items-center justify-center p-12 h-full">
                    <div className="w-6 h-6 rounded-full border-2 border-white/15 border-t-white/50 animate-spin" />
                  </div>
                }
              >
                <motion.div
                  initial={performanceMode ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={isActive ? { opacity: 1, y: 0 } : {}}
                  transition={
                    performanceMode ? { duration: 0.1 } : { duration: 0.24, ease: 'easeOut' }
                  }
                >
                  {SETTINGS_TAB_RENDERERS[tabId]({ onClose, settings, t })}
                </motion.div>
              </Suspense>
            </div>
          )
        })}
      </div>
    </main>
  )
}

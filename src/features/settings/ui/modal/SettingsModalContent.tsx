import { ScrollArea } from '@app/components/ui/scroll-area'
import { DURATION } from '@shared/lib/motion'
import { SettingsTabIcon } from '@shared/ui/components/primitives'
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

/**
 * Loading placeholder shaped like a settings tab: a compact intro strip and
 * three section cards. Matching the real rhythm means switching to a lazy tab
 * settles into place instead of collapsing to a single spinner.
 */
function SettingsTabSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6 pb-4 motion-safe:animate-pulse">
      <div className="flex items-center gap-3">
        <div className="bg-muted h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="bg-muted h-3.5 w-40 max-w-full rounded-full" />
          <div className="h-2.5 w-72 max-w-full rounded-full bg-zinc-900/60" />
        </div>
      </div>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="space-y-4 rounded-2xl border border-white/[0.07] bg-zinc-950/60 p-4"
        >
          <div className="bg-muted h-3 w-32 max-w-full rounded-full" />
          <div className="h-8 w-full rounded-lg bg-zinc-900/60" />
          <div className="flex gap-3">
            <div className="h-8 flex-1 rounded-lg bg-zinc-900/60" />
            <div className="h-8 w-24 shrink-0 rounded-lg bg-zinc-900/60" />
          </div>
        </div>
      ))}
    </div>
  )
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
      aria-hidden={!isActive}
      inert={!isActive ? true : undefined}
      style={{ display: isActive ? 'block' : 'none' }}
    >
      {/* Once a tab has been visited it stays mounted (hidden, inert) so
          drafts and local form state survive switching away and back. */}
      <Suspense fallback={<SettingsTabSkeleton />}>
        <TabComponent onClose={onClose} setActiveTab={setActiveTab} />
      </Suspense>
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
      className="flex min-w-0 flex-1 flex-col overflow-hidden"
    >
      <ScrollArea className="min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-10">
        <AnimatePresence mode="wait">
          {visitedTabsList.length === 0 || !activeTabMeta ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.normal }}
              className="flex h-full min-h-[300px] items-center justify-center"
            >
              <div className="relative flex w-full max-w-sm flex-col items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-zinc-950/60 px-6 py-7 text-center">
                <div className="bg-muted/40 motion-slow pointer-events-none absolute top-2 h-20 w-32 rounded-full blur-2xl" />
                <SettingsTabIcon>
                  <SettingsIcon className="h-5 w-5" />
                </SettingsTabIcon>
                <p className="text-ql-13 text-foreground font-semibold">
                  {t('select_setting_from_list')}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              // A single stable key: keying by tab would remount the whole
              // container and throw away the state we just kept mounted.
              key="tabs"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.normal }}
              className="mx-auto w-full max-w-3xl 2xl:max-w-4xl"
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

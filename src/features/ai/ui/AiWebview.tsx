import { memo, lazy, Suspense, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useAiCoreWorkspaceActions,
  useAiSessionUiPrefsState,
  useAiTabsSliceState
} from '@app/providers/AiContext'
import AiSession from './AiSession'
import AiTabStrip from './AiTabStrip'

const AiHomePage = lazy(() => import('./AiHomePage'))
const MagicSelectorTutorial = lazy(() => import('@features/tutorial/ui/MagicSelectorTutorial'))

interface AiWebviewProps {
  isResizing: boolean
  isBarHovered: boolean
}

const MAX_ALIVE_UNPINNED_TABS = 3

function AiWebview({ isResizing, isBarHovered }: AiWebviewProps) {
  const { tabs, activeTabId, aiViewRequestNonce } = useAiTabsSliceState()
  const { isTutorialActive } = useAiSessionUiPrefsState()
  const { setActiveTab, openAiWorkspace, stopTutorial } = useAiCoreWorkspaceActions()
  const [aliveTabIds, setAliveTabIds] = useState<string[]>(activeTabId ? [activeTabId] : [])
  const [showHome, setShowHome] = useState(() => tabs.length === 0 || !activeTabId)

  useEffect(() => {
    if (tabs.length === 0 || !activeTabId) {
      setShowHome(true)
    }
  }, [tabs.length, activeTabId])

  useEffect(() => {
    if (!activeTabId) return

    setAliveTabIds((prev) => {
      const filtered = prev.filter((id) => id !== activeTabId)
      const next = [activeTabId, ...filtered]
      return next.slice(0, MAX_ALIVE_UNPINNED_TABS)
    })
  }, [activeTabId])

  useEffect(() => {
    const currentTabIds = new Set(tabs.map((t) => t.id))
    setAliveTabIds((prev) => prev.filter((id) => currentTabIds.has(id)))
  }, [tabs])

  useEffect(() => {
    if (aiViewRequestNonce === 0 || tabs.length === 0 || !activeTabId) {
      return
    }

    setShowHome(false)
  }, [activeTabId, aiViewRequestNonce, tabs.length])

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId)
    setShowHome(false)
  }

  const handleOpenModel = (modelId: string) => {
    openAiWorkspace(modelId)
  }

  return (
    <div
      className="flex flex-1 flex-col relative min-h-0 overflow-hidden rounded-[1.5rem] bg-[#050505] transition-colors duration-300"
      style={{
        pointerEvents: isResizing ? 'none' : 'auto',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        clipPath: 'inset(0 round 1.5rem)'
      }}
    >
      <div className="pointer-events-none absolute inset-0 z-50 rounded-[1.5rem] border border-white/[0.07]" />

      <AiTabStrip
        showHome={showHome}
        onShowHome={() => setShowHome(true)}
        onHideHome={() => setShowHome(false)}
      />

      <div className="relative flex-1 min-h-0">
        <AnimatePresence>
          {showHome && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 z-10"
            >
              <Suspense fallback={null}>
                <AiHomePage onSelectTab={handleSelectTab} onOpenModel={handleOpenModel} />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {tabs.map((tab) => {
          const isMounted = tab.pinned || tab.id === activeTabId || aliveTabIds.includes(tab.id)

          if (!isMounted) return null

          return (
            <AiSession
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId && !showHome}
              isBarHovered={isBarHovered}
            />
          )
        })}
      </div>

      {isTutorialActive && (
        <div className="absolute inset-0 z-[100] bg-black">
          <Suspense fallback={null}>
            <MagicSelectorTutorial
              onClose={stopTutorial}
              onComplete={() => {
                stopTutorial()
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}

export default memo(AiWebview)

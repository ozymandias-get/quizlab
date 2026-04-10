import { memo, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useAiCoreWorkspaceActions,
  useAiSessionUiPrefsState,
  useAiTabsSliceState
} from '@app/providers/AiContext'
import AiSession from './AiSession'
import AiTabStrip from './AiTabStrip'
import { MAX_ALIVE_UNPINNED_TABS } from '@features/ai/constants/aiWebviewLifecycle'

const AiHomePage = lazy(() => import('./AiHomePage'))
const MagicSelectorTutorial = lazy(() => import('@features/tutorial/ui/MagicSelectorTutorial'))

interface AiWebviewProps {
  isResizing: boolean
  isBarHovered: boolean
}

function AiWebview({ isResizing, isBarHovered }: AiWebviewProps) {
  const { tabs, activeTabId, aiViewRequestNonce } = useAiTabsSliceState()
  const { isTutorialActive } = useAiSessionUiPrefsState()
  const { setActiveTab, openAiWorkspace, stopTutorial } = useAiCoreWorkspaceActions()
  const [aliveTabIds, setAliveTabIds] = useState<string[]>(activeTabId ? [activeTabId] : [])
  const [showHome, setShowHome] = useState(() => tabs.length === 0 || !activeTabId)
  const tabUrlCacheRef = useRef<Record<string, { url: string; modelId: string }>>({})

  const handleTabUrlChange = useCallback((tabId: string, modelId: string, url: string) => {
    tabUrlCacheRef.current[tabId] = { url, modelId }
  }, [])

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
    const cache = tabUrlCacheRef.current
    for (const id of Object.keys(cache)) {
      if (!currentTabIds.has(id)) {
        delete cache[id]
      }
    }
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
          const isMounted = tab.id === activeTabId || aliveTabIds.includes(tab.id)

          if (!isMounted) return null

          const cached = tabUrlCacheRef.current[tab.id]
          const restoredUrl = cached && cached.modelId === tab.modelId ? cached.url : undefined

          return (
            <AiSession
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId && !showHome}
              isBarHovered={isBarHovered}
              restoredUrl={restoredUrl}
              onTabUrlRecorded={handleTabUrlChange}
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

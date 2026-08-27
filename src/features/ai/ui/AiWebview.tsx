import { useAiLifecycleSettings } from '@features/ai/hooks/useAiLifecycleSettings'

import {
  useAiSessionActions,
  useAiSessionUiPrefsState,
  useAiTabActions,
  useAiTabsSliceState,
  useAiViewRequestNonce
} from '@app/providers/ai-context'
import { DURATION } from '@shared/lib/motion'

import { AnimatePresence, motion } from 'motion/react'
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import AiSession from './AiSession'
import AiTabStrip from './AiTabStrip'

const AiHomePage = lazy(() => import('./AiHomePage'))
const MagicSelectorTutorial = lazy(() => import('@features/tutorial/ui/MagicSelectorTutorial'))

const PANEL_STYLE = {
  border: '1px solid oklch(var(--border))',
  borderRadius: 'var(--radius-xl)'
} as const

interface AiWebviewProps {
  isResizing: boolean
  isBarHovered: boolean
}

function AiWebview({ isResizing, isBarHovered }: AiWebviewProps) {
  const { tabs, activeTabId } = useAiTabsSliceState()
  const aiViewRequestNonce = useAiViewRequestNonce()
  const { isTutorialActive } = useAiSessionUiPrefsState()
  const { openAiWorkspace } = useAiTabActions()
  const { stopTutorial } = useAiSessionActions()
  const { maxAliveTabs } = useAiLifecycleSettings()
  const [aliveTabIds, setAliveTabIds] = useState<string[]>(activeTabId ? [activeTabId] : [])
  const [showHome, setShowHome] = useState(() => tabs.length === 0 || !activeTabId)
  const tabUrlCacheRef = useRef<Record<string, { url: string; modelId: string }>>({})
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleTabUrlChange = useCallback((tabId: string, modelId: string, url: string) => {
    tabUrlCacheRef.current[tabId] = { url, modelId }
  }, [])

  // Combine showHome logic into one effect to avoid cascade:
  // when activeTabId/tabs change, both effects would fire separately.
  // Single effect → single re-render from showHome change.
  useEffect(() => {
    if (tabs.length === 0 || !activeTabId) {
      setShowHome(true)
    } else if (aiViewRequestNonce > 0) {
      setShowHome(false)
    }
  }, [tabs.length, activeTabId, aiViewRequestNonce])

  useEffect(() => {
    if (!activeTabId) return
    if (!isMountedRef.current) return

    const currentTabIds = new Set(tabs.map((t) => t.id))

    setAliveTabIds((prev) => {
      let next: string[]
      if (prev[0] === activeTabId) {
        next = prev
      } else {
        const filtered = prev.filter((id) => id !== activeTabId)
        next = [activeTabId, ...filtered]
      }

      next = next.filter((id) => currentTabIds.has(id))

      const cache = tabUrlCacheRef.current
      for (const id of Object.keys(cache)) {
        if (!currentTabIds.has(id)) {
          delete cache[id]
        }
      }

      const boundedNext = next.length > maxAliveTabs ? next.slice(0, maxAliveTabs) : next
      const isUnchanged =
        boundedNext.length === prev.length && boundedNext.every((id, index) => id === prev[index])

      // Tab metadata changes (for example a rename) run this effect too, but
      // they don't change which sessions are alive. Preserve the state
      // reference so React doesn't perform a redundant follow-up render.
      return isUnchanged ? prev : boundedNext
    })
  }, [activeTabId, maxAliveTabs, tabs])

  const handleShowHome = useCallback(() => setShowHome(true), [])
  const handleHideHome = useCallback(() => setShowHome(false), [])

  const aliveSet = useMemo(() => new Set(aliveTabIds), [aliveTabIds])

  const renderedSessions = useMemo(
    () =>
      tabs.map((tab) => {
        const isMounted = tab.id === activeTabId || aliveSet.has(tab.id)
        if (!isMounted) return null

        const isActive = tab.id === activeTabId && !showHome
        const cached = tabUrlCacheRef.current[tab.id]
        const restoredUrl = cached && cached.modelId === tab.modelId ? cached.url : undefined

        return (
          <AiSession
            key={tab.id}
            tab={tab}
            isActive={isActive}
            isBarHovered={isActive && isBarHovered}
            restoredUrl={restoredUrl}
            onTabUrlRecorded={handleTabUrlChange}
          />
        )
      }),
    [tabs, aliveSet, activeTabId, showHome, isBarHovered, handleTabUrlChange]
  )

  const panelStyle = useMemo(
    () => ({
      ...PANEL_STYLE,
      pointerEvents: isResizing ? ('none' as const) : ('auto' as const)
    }),
    [isResizing]
  )

  return (
    <div
      className="panel-3d-wrapper flex min-h-0 flex-1 flex-col"
      data-tour-id="tour-target-ai-webview"
    >
      <div
        className="glass-tier-1 panel-3d-right relative flex min-h-0 flex-1 flex-col overflow-hidden"
        style={panelStyle}
      >
        <AiTabStrip showHome={showHome} onShowHome={handleShowHome} onHideHome={handleHideHome} />

        <div className="relative min-h-0 flex-1">
          <AnimatePresence>
            {showHome && (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.slow }}
                className="absolute inset-0 z-10"
              >
                <Suspense fallback={null}>
                  <AiHomePage onOpenModel={openAiWorkspace} />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>

          {renderedSessions}
        </div>

        {isTutorialActive && (
          <div className="z-overlay bg-background absolute inset-0">
            <Suspense fallback={null}>
              <MagicSelectorTutorial onClose={stopTutorial} onComplete={stopTutorial} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(AiWebview)

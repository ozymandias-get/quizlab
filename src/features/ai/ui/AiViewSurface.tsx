import type { AiViewSurfaceState } from '@features/ai/hooks/useAiViewSurfaceState'

import {
  useAiSessionActions,
  useAiSessionUiPrefsState,
  useAiTabActions,
  useAiTabsSliceState
} from '@app/providers/ai-context'
import { DURATION } from '@shared/lib/motion'

import { AnimatePresence, motion } from 'motion/react'
import { lazy, memo, Suspense, useMemo } from 'react'

import AiSession from './AiSession'
import AiTabStrip from './AiTabStrip'

const AiHomePage = lazy(() => import('./AiHomePage'))
const MagicSelectorTutorial = lazy(() =>
  import('@features/tutorial').then((m) => ({ default: m.MagicSelectorTutorial }))
)

const PANEL_STYLE = {
  border: '1px solid oklch(var(--border))',
  borderRadius: 'var(--radius-xl)'
} as const

interface AiViewSurfaceProps {
  isResizing: boolean
  isBarHovered: boolean
  /**
   * Which React surface this instance is. Exactly one of the mounted surfaces
   * (workspace / focus overlay) is active at a time, and only the active one may
   * position the managed native views. That single-writer rule is what turns a
   * focus-mode handoff into a reposition instead of a rebuild.
   */
  isSurfaceActive: boolean
  surfaceState: AiViewSurfaceState
}

/**
 * The AI panel chrome: tab strip, AI Home, Magic Selector tutorial, and one host
 * placeholder per alive tab.
 *
 * The remote pages themselves live in the main process as `WebContentsView`s;
 * this component renders only the DOM shell that positions them.
 */
function AiViewSurface({
  isResizing,
  isBarHovered,
  isSurfaceActive,
  surfaceState
}: AiViewSurfaceProps) {
  const { tabs, activeTabId } = useAiTabsSliceState()
  const { isTutorialActive } = useAiSessionUiPrefsState()
  const { openAiWorkspace } = useAiTabActions()
  const { stopTutorial } = useAiSessionActions()

  const { aliveTabIds, showHome, showHideHome, recordTabUrl, getRestoredUrl } = surfaceState
  const isOverlayActive = showHome || isTutorialActive

  const aliveSet = useMemo(() => new Set(aliveTabIds), [aliveTabIds])

  const renderedSessions = useMemo(
    () =>
      tabs.map((tab) => {
        if (!aliveSet.has(tab.id)) return null

        const isActive = tab.id === activeTabId && !showHome

        return (
          <AiSession
            key={tab.id}
            tab={tab}
            isActive={isActive}
            isBarHovered={isActive && isBarHovered}
            isResizing={isActive && isResizing}
            isSurfaceActive={isSurfaceActive}
            isOverlayActive={isOverlayActive}
            restoredUrl={getRestoredUrl(tab.id, tab.modelId)}
            onTabUrlRecorded={recordTabUrl}
          />
        )
      }),
    [
      tabs,
      aliveSet,
      activeTabId,
      showHome,
      isBarHovered,
      isResizing,
      isSurfaceActive,
      isOverlayActive,
      getRestoredUrl,
      recordTabUrl
    ]
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
        <AiTabStrip
          showHome={showHome}
          onShowHome={showHideHome.show}
          onHideHome={showHideHome.hide}
        />

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

AiViewSurface.displayName = 'AiViewSurface'

export default memo(AiViewSurface)

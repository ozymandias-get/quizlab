import type { AiViewSurfaceState } from '@features/ai/hooks/useAiViewSurfaceState'

import { useAiTabActions, useAiTabsSliceState } from '@app/providers/ai-context'
import { useIsAnyDialogOpen } from '@shared/hooks'
import { DURATION } from '@shared/lib/motion'

import { AnimatePresence, motion } from 'motion/react'
import { lazy, memo, Suspense, useMemo } from 'react'

import AiSession from './AiSession'
import AiTabStrip from './AiTabStrip'

const AiHomePage = lazy(() => import('./AiHomePage'))

const PANEL_STYLE = {
  border: '1px solid oklch(var(--border))',
  borderRadius: 'var(--radius-xl)'
} as const

interface AiViewSurfaceProps {
  isResizing: boolean
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
 * The AI panel chrome: tab strip, AI Home, and one host
 * placeholder per alive tab.
 *
 * The remote pages themselves live in the main process as `WebContentsView`s;
 * this component renders only the DOM shell that positions them.
 */
function AiViewSurface({ isResizing, isSurfaceActive, surfaceState }: AiViewSurfaceProps) {
  const { tabs, activeTabId } = useAiTabsSliceState()
  const { openAiWorkspace } = useAiTabActions()
  const isDialogOpen = useIsAnyDialogOpen()

  const { aliveTabIds, showHome, showHideHome, recordTabUrl, getRestoredUrl } = surfaceState
  // A native view is composited above every DOM layer, so any full-panel DOM
  // overlay — or any dialog anywhere in the app — has to be able to hide it.
  const isOverlayActive = showHome || isDialogOpen

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
    <div className="panel-3d-wrapper flex min-h-0 flex-1 flex-col">
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
      </div>
    </div>
  )
}

AiViewSurface.displayName = 'AiViewSurface'

export default memo(AiViewSurface)

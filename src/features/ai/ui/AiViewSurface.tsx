import type { AiViewSurfaceState } from '@features/ai/hooks/useAiViewSurfaceState'

import { useAiTabActions, useAiTabsSliceState } from '@app/providers/ai-context'
import { useIsAnyDialogOpen } from '@shared/hooks'
import { DURATION } from '@shared/lib/motion'

import { AnimatePresence, motion } from 'motion/react'
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createRecentAiWorkEntry, recordRecentAiWork } from '../lib/recentWork'
import AiSession from './AiSession'
import AiTabStrip from './AiTabStrip'

const AiHomePage = lazy(() => import('./AiHomePage'))

const PANEL_STYLE = {
  border: '1px solid oklch(var(--border) / 0.7)',
  borderRadius: 'var(--radius-2xl)'
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
  /**
   * True while the panel wrapping this surface is still revealing itself — the
   * focus overlay's clip-path expansion.
   *
   * The native view is composited above the DOM and does not inherit
   * `clip-path`, so showing it mid-reveal paints the site outside the visible
   * panel, over the backdrop. Keeping it hidden until the shell settles makes
   * the first visible frame the settled one.
   */
  isRevealInProgress?: boolean
  /**
   * True for a surface that is still mounted underneath an open focus shell.
   *
   * The workspace now plays an exit animation while focus mode opens, so it
   * keeps its DOM for a couple of hundred milliseconds after the shell has
   * taken over. A `WebContentsView` is composited above every DOM layer and
   * does not fade with its panel, so without this flag the exiting workspace
   * would keep painting the AI site on top of the focus overlay (including the
   * PDF-only shell, which mounts no host of its own to hide it).
   */
  isBehindFocusShell?: boolean
  surfaceState: AiViewSurfaceState
}

/**
 * The AI panel chrome: tab strip, AI Home, and one host
 * placeholder per alive tab.
 *
 * The remote pages themselves live in the main process as `WebContentsView`s;
 * this component renders only the DOM shell that positions them.
 */
function AiViewSurface({
  isResizing,
  isSurfaceActive,
  isRevealInProgress = false,
  isBehindFocusShell = false,
  surfaceState
}: AiViewSurfaceProps) {
  const { tabs, activeTabId } = useAiTabsSliceState()
  const { openAiWorkspace, setActiveTab } = useAiTabActions()
  const isDialogOpen = useIsAnyDialogOpen()

  const {
    aliveTabIds,
    showHome,
    showHideHome,
    recordTabUrl,
    getRestoredUrl,
    tabUrlRequests,
    requestTabUrl,
    clearTabUrlRequest
  } = surfaceState
  const openSavedUrl = useCallback(
    (modelId: string, url: string) => {
      const matchingTab = tabs.find(
        (tab) => tab.modelId === modelId && getRestoredUrl(tab.id, modelId) === url
      )
      // An already-open conversation is activated in place. Otherwise a fresh
      // tab is created with the URL as its entry URL, which uses the same
      // restore path as a cold tab and does not depend on navigating a live
      // view after the fact.
      const tabId = matchingTab
        ? openAiWorkspace(modelId, { tabId: matchingTab.id })
        : openAiWorkspace(modelId, { forceNew: true })
      requestTabUrl(tabId, modelId, url)
    },
    [getRestoredUrl, openAiWorkspace, requestTabUrl, tabs]
  )

  const hideHome = showHideHome.hide
  const openHomeTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId)
      hideHome()
    },
    [setActiveTab, hideHome]
  )

  const openRecentWork = useCallback(
    (modelId: string, url?: string) => {
      if (!url) {
        openAiWorkspace(modelId)
        return
      }
      const touchedEntry = createRecentAiWorkEntry(modelId, url)
      if (touchedEntry) recordRecentAiWork(touchedEntry)
      openSavedUrl(modelId, url)
    },
    [openAiWorkspace, openSavedUrl]
  )
  // A native view is composited above every DOM layer, so any full-panel DOM
  // overlay — or any dialog anywhere in the app — has to be able to hide it.
  // `isRevealInProgress` is the same rule for the focus shell's clip-path
  // expansion: `clip-path` cannot clip a view that is not in the DOM tree.
  // `isBehindFocusShell` extends it to a workspace that is still animating out
  // under an open shell.
  const isOverlayActive = showHome || isDialogOpen || isBehindFocusShell

  // Briefly cover the native view while a different AI tab takes over: the
  // outgoing WebContentsView paints its last frame above the DOM, so without
  // this the user sees the previous platform frozen during the switch.
  const [switchingTabId, setSwitchingTabId] = useState<string | null>(null)
  const previousActiveTabRef = useRef(activeTabId)
  useEffect(() => {
    if (previousActiveTabRef.current === activeTabId) return
    previousActiveTabRef.current = activeTabId
    // Closing the last tab is a switch to "no tab": clear any veil state,
    // otherwise `overlayBlocksViews` can stay true and hide every native view.
    setSwitchingTabId(activeTabId || null)
    if (!activeTabId) return
    const timer = window.setTimeout(() => setSwitchingTabId(null), 500)
    return () => window.clearTimeout(timer)
  }, [activeTabId])

  const switchingTab = switchingTabId
    ? (tabs.find((tab) => tab.id === switchingTabId) ?? null)
    : null
  const overlayBlocksViews = isOverlayActive || isRevealInProgress || switchingTabId !== null

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
            isOverlayActive={overlayBlocksViews}
            isBehindFocusShell={isBehindFocusShell}
            restoredUrl={getRestoredUrl(tab.id, tab.modelId)}
            urlRequest={tabUrlRequests[tab.id]}
            onUrlRequestHandled={clearTabUrlRequest}
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
      isBehindFocusShell,
      overlayBlocksViews,
      getRestoredUrl,
      tabUrlRequests,
      clearTabUrlRequest,
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
          getTabUrl={getRestoredUrl}
          sleepingTabIds={surfaceState.coldTabIds}
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
                  <AiHomePage
                    onOpenModel={openAiWorkspace}
                    onOpenTab={openHomeTab}
                    onOpenRecent={openRecentWork}
                    onOpenPinned={openSavedUrl}
                  />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>

          {renderedSessions}

          <AnimatePresence>
            {switchingTab && (
              <motion.div
                key={`switching-${switchingTab.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.fast }}
                aria-hidden
                data-testid="ai-view-switching-veil"
                // The veil only has to hide the outgoing native frame; a brand
                // mark here duplicated the incoming site's loader icon and the
                // two painted on top of each other. No `backdrop-filter` either:
                // a `WebContentsView` is not part of the DOM's backdrop, so the
                // blur could only soften the panel's own empty shell while
                // costing a full-panel filter pass on every tab switch.
                className="pointer-events-none absolute inset-0 z-20 bg-zinc-950/60"
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

AiViewSurface.displayName = 'AiViewSurface'

export default memo(AiViewSurface)

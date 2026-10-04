import type { AiContentController } from '@shared-core/types/aiContent'

import { useAiLifecycleSettings } from '@features/ai/hooks/useAiLifecycleSettings'

import type { Tab } from '@app/providers/ai-context'
import { useAiContentHostActions, useAiSites } from '@app/providers/ai-context'
import { useManagedContentView } from '@shared/hooks/aiContent/useManagedContentView'
import AestheticLoader from '@ui/components/AestheticLoader'

import { type CSSProperties, lazy, memo, Suspense, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import SleepPlaceholderView from './SleepPlaceholderView'
import {
  useAiSessionEntryUrl,
  useAiSessionSleep,
  useAiSessionStaleCheck
} from './useAiSessionContentView'

const AiErrorView = lazy(() => import('./AiErrorView'))
const ApiChatPage = lazy(() => import('./ApiChatPage'))

interface AiSessionProps {
  tab: Tab
  isActive: boolean
  isBarHovered: boolean
  /** True while the app is dragging the panel divider. */
  isResizing: boolean
  /**
   * True when this host lives on the surface the user is currently looking at.
   * Only the active surface may position the managed view, so a placeholder
   * that is still mounted behind a focus-mode animation cannot fight it.
   */
  isSurfaceActive: boolean
  /** True while a full-panel overlay (AI Home, Magic Selector tutorial) is up. */
  isOverlayActive: boolean
  /** Last URL before cold unmount; must match current model (parent validates). */
  restoredUrl?: string
  onTabUrlRecorded?: (tabId: string, modelId: string, url: string) => void
}

/**
 * One AI tab.
 *
 * The remote site is a `WebContentsView` owned by the main process; this
 * component contributes a sized placeholder and decides when that view may be on
 * screen. It never touches the remote page's internals, which is what lets a tab
 * switch, a sleep/wake cycle and a focus-mode handoff all be handled as geometry
 * changes instead of teardowns.
 */
const AiSession = memo(
  ({
    tab,
    isActive,
    isBarHovered,
    isResizing,
    isSurfaceActive,
    isOverlayActive,
    restoredUrl,
    onTabUrlRecorded
  }: AiSessionProps) => {
    const aiSites = useAiSites()
    const { registerContent } = useAiContentHostActions()
    const { t } = useTranslation()
    const { sleepTimeoutMs, isNeverSleepSite } = useAiLifecycleSettings()

    const siteConfig = aiSites[tab.modelId]
    const isApiChat = tab.modelId === 'api-chat'

    const { isSleeping, handleWakeUp } = useAiSessionSleep(
      isActive,
      sleepTimeoutMs,
      isNeverSleepSite,
      tab.modelId
    )

    const { entryUrl } = useAiSessionEntryUrl(tab.modelId, isSleeping, restoredUrl, siteConfig?.url)
    const { handlePageSettled } = useAiSessionStaleCheck(siteConfig?.url, isActive)

    const canHostRemoteView = Boolean(siteConfig) && !isApiChat && !isSleeping

    const reportNavigationUrl = useCallback(
      (url: string) => {
        onTabUrlRecorded?.(tab.id, tab.modelId, url)
      },
      [onTabUrlRecorded, tab.id, tab.modelId]
    )

    const registerInstance = useCallback(
      (instance: AiContentController | null, expected?: AiContentController) => {
        registerContent(tab.id, instance, expected)
      },
      [registerContent, tab.id]
    )

    const managed = useManagedContentView({
      viewId: tab.id,
      source: { kind: 'ai-platform', modelId: tab.modelId },
      restoredUrl: entryUrl,
      modelId: tab.modelId,
      isEnabled: canHostRemoteView,
      isHostOwner: canHostRemoteView && isSurfaceActive && isActive,
      visible: canHostRemoteView && isActive && isSurfaceActive && !isOverlayActive,
      revealAfterFirstLoad: true,
      hideWhenError: true,
      // A native view paints above every DOM layer, so the bottom bar can no
      // longer shield it with an overlay. Forwarding the guest's mouse input to
      // the app keeps the bar's hover and drag handling working while the page
      // stays painted and interactive everywhere else.
      ignoreMouse: isActive && isSurfaceActive && (isBarHovered || isResizing),
      onUrlChange: reportNavigationUrl,
      onPageSettled: handlePageSettled,
      registerContent: registerInstance
    })

    const { isLoading, error, handleRetry, setHostElement } = managed

    const visibilityStyle = useMemo<CSSProperties>(
      () => ({
        visibility: isActive ? 'visible' : 'hidden',
        zIndex: isActive ? 1 : 0
      }),
      [isActive]
    )

    return (
      <div className="absolute inset-0 flex flex-col" style={visibilityStyle}>
        <div className="relative flex min-h-0 flex-1 flex-col">
          {isApiChat ? (
            <Suspense fallback={<AestheticLoader />}>
              <ApiChatPage tabId={tab.id} />
            </Suspense>
          ) : isSleeping ? (
            <SleepPlaceholderView onWakeUp={handleWakeUp} t={t} />
          ) : (
            <div ref={setHostElement} className="h-full w-full flex-1" data-ai-view-host={tab.id} />
          )}

          {isBarHovered && isActive && isSurfaceActive && !isSleeping && !isApiChat && (
            <div className="z-surface-4 pointer-events-auto absolute inset-0 bg-transparent" />
          )}

          {isLoading && isActive && !isSleeping && !isApiChat && <AestheticLoader />}

          {error && isActive && !isSleeping && !isApiChat && (
            <Suspense fallback={null}>
              <AiErrorView error={error} onRetry={handleRetry} aiName={siteConfig?.displayName} />
            </Suspense>
          )}
        </div>
      </div>
    )
  }
)

AiSession.displayName = 'AiSession'

export default AiSession

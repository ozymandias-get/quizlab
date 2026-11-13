import type { AiContentController } from '@shared-core/types/aiContent'

import { useAiLifecycleSettings } from '@features/ai/hooks/useAiLifecycleSettings'
import type { AiTabUrlRequest } from '@features/ai/hooks/useAiViewSurfaceState'

import { BlurFade } from '@app/components/ui/blur-fade'
import { useToastActions } from '@app/providers'
import type { Tab } from '@app/providers/ai-context'
import { useAiContentHostActions, useAiSites } from '@app/providers/ai-context'
import { useManagedContentView } from '@shared/hooks/aiContent/useManagedContentView'
import { getElectronApi } from '@shared/lib/electronApi'
import AiSiteLoader from '@ui/components/AiSiteLoader'

import {
  type CSSProperties,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
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
  /**
   * True when this host lives on the surface the user is currently looking at.
   * Only the active surface may position the managed view, so a placeholder
   * that is still mounted behind a focus-mode animation cannot fight it.
   */
  isSurfaceActive: boolean
  /** True while a full-panel overlay (AI Home) is up. */
  isOverlayActive: boolean
  /** Last URL before cold unmount; must match current model (parent validates). */
  restoredUrl?: string
  /** One-shot "open this conversation" request coming from AI Home. */
  urlRequest?: AiTabUrlRequest
  onUrlRequestHandled?: (tabId: string) => void
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
    isSurfaceActive,
    isOverlayActive,
    restoredUrl,
    urlRequest,
    onUrlRequestHandled,
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

    const [entryOverride, setEntryOverride] = useState<{ url: string; seq: number } | null>(() =>
      urlRequest && urlRequest.modelId === tab.modelId
        ? { url: urlRequest.url, seq: urlRequest.nonce }
        : null
    )
    const pendingNavigationRef = useRef<{ url: string; nonce: number } | null>(null)

    useEffect(() => {
      if (!urlRequest || urlRequest.modelId !== tab.modelId) return
      pendingNavigationRef.current = { url: urlRequest.url, nonce: urlRequest.nonce }
      setEntryOverride((current) =>
        current?.seq === urlRequest.nonce ? current : { url: urlRequest.url, seq: urlRequest.nonce }
      )
      onUrlRequestHandled?.(tab.id)
    }, [onUrlRequestHandled, tab.id, tab.modelId, urlRequest])

    const { entryUrl } = useAiSessionEntryUrl(
      tab.modelId,
      isSleeping,
      entryOverride?.url ?? restoredUrl,
      siteConfig?.url,
      entryOverride?.seq
    )
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

    const { showWarning } = useToastActions()
    const managed = useManagedContentView({
      viewId: tab.id,
      showWarning,
      source: { kind: 'ai-platform', modelId: tab.modelId },
      restoredUrl: entryUrl,
      modelId: tab.modelId,
      isEnabled: canHostRemoteView,
      // Ownership is deliberately NOT gated on `isActive`. Ownership answers
      // "which placeholder may position this view", and losing it while the view
      // is still on screen would leave nobody able to say `visible: false` — the
      // last rectangle would stay painted over whatever is now on top. Keeping
      // ownership lets an inactive tab hide itself, which is what makes AI Home
      // and tab switching clear the view instead of stranding it.
      isHostOwner: canHostRemoteView && isSurfaceActive,
      visible: canHostRemoteView && isActive && isSurfaceActive && !isOverlayActive,
      revealAfterFirstLoad: true,
      hideWhenError: true,
      onUrlChange: reportNavigationUrl,
      onPageSettled: handlePageSettled,
      registerContent: registerInstance
    })

    const { isLoading, error, handleRetry, hasLoadedOnce, setHostElement } = managed

    // A live view ignores `restoredUrl` on re-attach (the attach path only uses
    // it when it creates the view), so the one-shot request is applied here,
    // after the guest is actually mounted. Waiting for `hasLoadedOnce` removes
    // the race where the initial entry load overwrites a navigation issued
    // while the view was still being created.
    useEffect(() => {
      const pending = pendingNavigationRef.current
      if (!pending || isSleeping || !canHostRemoteView || !hasLoadedOnce) return

      let cancelled = false
      const isCurrentRequest = () =>
        !cancelled && pendingNavigationRef.current?.nonce === pending.nonce

      void (async () => {
        const api = getElectronApi()
        if (!api) return

        const loadPending = () =>
          api.aiView.loadUrl({ viewId: tab.id, url: pending.url }).catch(() => false)

        const currentUrl = await api.aiView.getUrl({ viewId: tab.id }).catch(() => null)
        if (!isCurrentRequest()) return

        if (currentUrl !== pending.url) {
          let loaded = await loadPending()
          if (!isCurrentRequest()) return

          // One bounded retry for a transient failure. The request stays pending
          // on the second failure; a later wake/request can retry it, but this
          // effect must not spin.
          if (!loaded) {
            await new Promise((resolve) => setTimeout(resolve, 750))
            if (!isCurrentRequest()) return
            loaded = await loadPending()
            if (!isCurrentRequest()) return
          }

          if (!loaded) return
        }

        // Only the request that is still current may clear the slot. A newer
        // request that arrived during the await must keep its target.
        if (isCurrentRequest()) pendingNavigationRef.current = null
      })()
      return () => {
        cancelled = true
      }
    }, [canHostRemoteView, entryOverride?.seq, hasLoadedOnce, isSleeping, tab.id])

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
            <Suspense fallback={<AiSiteLoader modelId={tab.modelId} iconKey={siteConfig?.icon} />}>
              <ApiChatPage tabId={tab.id} />
            </Suspense>
          ) : isSleeping ? (
            <SleepPlaceholderView onWakeUp={handleWakeUp} t={t} />
          ) : (
            <div ref={setHostElement} className="h-full w-full flex-1" data-ai-view-host={tab.id} />
          )}

          {isLoading && isActive && !isSleeping && !isApiChat && (
            <BlurFade duration={0.3} offset={4} blur="3px" className="absolute inset-0 z-10">
              <AiSiteLoader modelId={tab.modelId} iconKey={siteConfig?.icon} />
            </BlurFade>
          )}

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

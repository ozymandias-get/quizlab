import type { WebviewController } from '@shared-core/types/webview'

import { useAiLifecycleSettings } from '@features/ai/hooks/useAiLifecycleSettings'

import { useToastActions } from '@app/providers'
import type { Tab } from '@app/providers/AiContext'
import { useAiRegistryMeta, useAiSites, useAiWebviewHostActions } from '@app/providers/AiContext'
import { WEBVIEW_ALLOW_POPUPS } from '@shared/constants/electronWebview'
import { useWebviewLifecycle } from '@shared/hooks/webview/useWebviewLifecycle'
import AestheticLoader from '@ui/components/AestheticLoader'

import {
  type CSSProperties,
  lazy,
  memo,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'

import SleepPlaceholderView from './SleepPlaceholderView'
import {
  useAiSessionSleep,
  useAiSessionStaleCheck,
  useAiSessionWebviewGeneration
} from './useAiSessionWebview'

const AiErrorView = lazy(() => import('./AiErrorView'))
const ApiChatPage = lazy(() => import('./ApiChatPage'))

interface AiSessionProps {
  tab: Tab
  isActive: boolean
  isBarHovered: boolean
  /** Last URL before cold unmount; must match current model (parent validates). */
  restoredUrl?: string
  onTabUrlRecorded?: (tabId: string, modelId: string, url: string) => void
}

/**
 * Single AI Session (Webview)
 */
const AiSession = memo(
  ({ tab, isActive, isBarHovered, restoredUrl, onTabUrlRecorded }: AiSessionProps) => {
    const { chromeUserAgent } = useAiRegistryMeta()
    const aiSites = useAiSites()
    const { registerWebview } = useAiWebviewHostActions()
    const { showWarning } = useToastActions()
    const { t } = useTranslation()
    const { sleepTimeoutMs, isNeverSleepSite } = useAiLifecycleSettings()

    const [webviewRecoveryKey, setWebviewRecoveryKey] = useState(0)
    const { isSleeping, setIsSleeping, handleWakeUp } = useAiSessionSleep(
      isActive,
      sleepTimeoutMs,
      isNeverSleepSite,
      tab.modelId
    )

    const handleCrashRecovery = useCallback(() => {
      setWebviewRecoveryKey((current) => current + 1)
    }, [])

    const reportNavigationUrl = useCallback(
      (url: string) => {
        onTabUrlRecorded?.(tab.id, tab.modelId, url)
      },
      [onTabUrlRecorded, tab.id, tab.modelId]
    )

    const registerInstance = useCallback(
      (instance: WebviewController | null) => {
        registerWebview(tab.id, instance)
      },
      [registerWebview, tab.id]
    )

    const siteConfig = aiSites[tab.modelId]
    const initialUrl = siteConfig?.url

    const { webviewSrc } = useAiSessionWebviewGeneration(
      tab.modelId,
      isSleeping,
      webviewRecoveryKey,
      restoredUrl,
      initialUrl
    )
    const { handlePageSettled } = useAiSessionStaleCheck(initialUrl, isActive)

    const { isLoading, error, onWebviewRef, handleRetry } = useWebviewLifecycle({
      currentAI: tab.modelId,
      registerWebview: registerInstance,
      t,
      showWarning,
      onUrlChange: onTabUrlRecorded ? reportNavigationUrl : undefined,
      onPageSettled: handlePageSettled,
      onCrashRecoveryRequested: handleCrashRecovery
    })
    const partition = useMemo(() => {
      // Use the platform's explicit partition if defined (e.g. 'persist:ai_chatgpt')
      if (siteConfig?.partition) return siteConfig.partition

      // SECURITY: Every AI webview must have an isolated partition to prevent
      // session/cookie leakage between services when multiple AI webviews are
      // open simultaneously in split-screen mode. Without isolation, logging
      // into one service could interfere with another's session.
      //
      // Custom and unrecognized platforms get a unique partition keyed by
      // modelId. The 'persist:ai_custom_' prefix is dynamically allowed by the
      // security layer's webview partition validation (see electron/app/window/security.ts).
      return `persist:ai_custom_${tab.modelId}`
    }, [siteConfig, tab.modelId])

    const isApiChat = tab.modelId === 'api-chat'

    const canRenderWebview = Boolean(siteConfig) && !isSleeping

    const webview = useMemo(() => {
      if (!canRenderWebview) return null

      return (
        <webview
          key={`${tab.modelId}:${webviewRecoveryKey}`}
          ref={onWebviewRef}
          src={webviewSrc}
          partition={partition}
          className="h-full w-full flex-1"
          // React's `DetailedHTMLProps<HTMLAttributes>` types `allowpopups` as
          // `boolean | undefined`, but Electron's `<webview>` accepts a string
          // token (`'true' | undefined`) which also suppresses React's
          // "non-boolean attribute" runtime warning. The string cast is
          // necessary because of this known JSX/React type mismatch; see
          // `src/shared/types/global.d.ts` for the augmented type.
          allowpopups={(WEBVIEW_ALLOW_POPUPS ? 'true' : undefined) as any}
          webpreferences="contextIsolation=yes, sandbox=yes, backgroundThrottling=yes"
          useragent={chromeUserAgent}
        />
      )
    }, [
      canRenderWebview,
      chromeUserAgent,
      webviewSrc,
      onWebviewRef,
      partition,
      tab.modelId,
      webviewRecoveryKey
    ])

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
            webview
          )}

          {/* Mouse Catcher: Prevents webview from swallowing mouse events when bar is hovered */}
          {isBarHovered && isActive && !isSleeping && !isApiChat && (
            <div className="pointer-events-auto absolute inset-0 z-[5] bg-transparent" />
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

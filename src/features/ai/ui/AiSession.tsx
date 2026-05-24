import { useMemo, memo, useCallback, useState, useEffect, useRef } from 'react'
import { useToastActions, useLanguageStrings } from '@app/providers'
import {
  useAiModelsCatalog,
  useAiRegistryMeta,
  useAiWebviewHostActions
} from '@app/providers/AiContext'
import type { Tab } from '@app/providers/AiContext'
import AestheticLoader from '@ui/components/AestheticLoader'
import { useWebviewLifecycle } from '@shared/hooks/webview/useWebviewLifecycle'
import { WEBVIEW_ALLOW_POPUPS } from '@shared/constants/electronWebview'
import { reportSuppressedError } from '@shared/lib/logger'
import type { WebviewController, WebviewElement } from '@shared-core/types/webview'
import AiErrorView from './AiErrorView'
import ApiChatPage from './ApiChatPage'
import {
  AI_TAB_SLEEP_MS,
  STALE_CONTENT_DETECTION_SCRIPT
} from '@features/ai/constants/aiWebviewLifecycle'
import { SleepPlaceholderView } from './SleepPlaceholderView'

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
    const { aiSites } = useAiModelsCatalog()
    const { registerWebview } = useAiWebviewHostActions()
    const { showWarning } = useToastActions()
    const { t } = useLanguageStrings()

    const [isSleeping, setIsSleeping] = useState(false)
    const [webviewRecoveryKey, setWebviewRecoveryKey] = useState(0)
    const staleCheckHandle = useRef<{ cancel: () => void } | null>(null)
    const staleCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
      let timeout: ReturnType<typeof setTimeout> | undefined
      if (!isActive) {
        timeout = setTimeout(() => {
          setIsSleeping(true)
        }, AI_TAB_SLEEP_MS)
      } else {
        setIsSleeping(false)
      }
      return () => {
        if (timeout !== undefined) clearTimeout(timeout)
      }
    }, [isActive])

    const handleWakeUp = useCallback(() => {
      setIsSleeping(false)
    }, [])

    const handleCrashRecovery = useCallback(() => {
      staleCheckHandle.current?.cancel()
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

    // Stable src for the webview. Only recomputed when the webview is freshly
    // mounted: model change (key swap) or sleep→wake (isSleeping transition).
    // Excluding restoredUrl/initialUrl from deps prevents parent re-renders
    // (which update the URL cache ref) from changing the src attribute and
    // causing the webview to re-navigate to its own current URL.
    const webviewSrc = useMemo(() => restoredUrl ?? initialUrl, [tab.modelId, isSleeping])

    useEffect(() => {
      return () => {
        staleCheckHandle.current?.cancel()
        if (staleCheckTimerRef.current !== null) {
          clearTimeout(staleCheckTimerRef.current)
          staleCheckTimerRef.current = null
        }
      }
    }, [])

    const handlePageSettled = useCallback(
      (wv: WebviewElement) => {
        staleCheckHandle.current?.cancel()
        if (staleCheckTimerRef.current !== null) {
          clearTimeout(staleCheckTimerRef.current)
          staleCheckTimerRef.current = null
        }
        if (!initialUrl) return
        if (!isActive) return

        let cancelled = false
        staleCheckHandle.current = {
          cancel: () => {
            cancelled = true
          }
        }

        const runCheck = async () => {
          staleCheckTimerRef.current = null
          if (cancelled || !wv) return

          try {
            const currentUrl = wv.getURL?.()
            if (!currentUrl) {
              return
            }

            const c = new URL(currentUrl)
            const b = new URL(initialUrl)
            if (
              c.origin === b.origin &&
              c.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '')
            ) {
              return
            }

            const isStale = await wv.executeJavaScript(STALE_CONTENT_DETECTION_SCRIPT)
            if (cancelled) return

            if (isStale) {
              wv.loadURL?.(initialUrl)
            }
          } catch (error) {
            reportSuppressedError('aiSession.staleContentCheck', { cause: error })
          }
        }

        staleCheckTimerRef.current = setTimeout(runCheck, 500)
      },
      [initialUrl]
    )

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
      if (!siteConfig) return 'persist:ai_session'
      if (siteConfig.partition) return siteConfig.partition
      if (siteConfig.isSite) return `temp_${tab.modelId}_${tab.id}`
      return 'persist:ai_session'
    }, [siteConfig, tab.id, tab.modelId])

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
          className="flex-1 w-full h-full"
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

    return (
      <div
        className="absolute inset-0 flex flex-col"
        style={{
          visibility: isActive ? 'visible' : 'hidden',
          zIndex: isActive ? 1 : 0
        }}
      >
        <div className="flex-1 relative flex flex-col min-h-0">
          {isApiChat ? (
            <ApiChatPage tabId={tab.id} />
          ) : isSleeping ? (
            <SleepPlaceholderView onWakeUp={handleWakeUp} t={t} />
          ) : (
            webview
          )}

          {/* Mouse Catcher: Prevents webview from swallowing mouse events when bar is hovered */}
          {isBarHovered && isActive && !isSleeping && !isApiChat && (
            <div className="absolute inset-0 z-[5] pointer-events-auto bg-transparent" />
          )}

          {isLoading && isActive && !isSleeping && !isApiChat && <AestheticLoader />}

          {error && isActive && !isSleeping && !isApiChat && (
            <AiErrorView error={error} onRetry={handleRetry} aiName={siteConfig?.displayName} />
          )}
        </div>
      </div>
    )
  }
)

AiSession.displayName = 'AiSession'

export default AiSession

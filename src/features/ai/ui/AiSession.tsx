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
import type { WebviewController, WebviewElement } from '@shared-core/types/webview'
import AiErrorView from './AiErrorView'
import { AI_TAB_SLEEP_MS } from '@features/ai/constants/aiWebviewLifecycle'

const STALE_CONTENT_CHECK_DELAY_MS = 2500
const STALE_CONTENT_DETECTION_SCRIPT = `
(() => {
  const hasComposer = Boolean(
    document.querySelector(
      'textarea, [contenteditable="true"][role="textbox"], div[role="textbox"]'
    )
  );
  if (hasComposer) return false;
  const t = (document.body?.innerText || '').toLowerCase();
  return (
    t.includes('could not be loaded') ||
    t.includes("couldn't be loaded") ||
    t.includes('yüklenemedi') ||
    t.includes("doesn't exist") ||
    t.includes('mevcut değil') ||
    t.includes('no longer available') ||
    t.includes('conversation not found') ||
    t.includes('silinmiş')
  );
})()
`

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

    useEffect(() => {
      let timeout: NodeJS.Timeout
      if (!isActive) {
        timeout = setTimeout(() => {
          setIsSleeping(true)
        }, AI_TAB_SLEEP_MS)
      } else {
        setIsSleeping(false)
      }
      return () => clearTimeout(timeout)
    }, [isActive])

    const handleWakeUp = useCallback(() => {
      setIsSleeping(false)
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

    const staleCheckHandle = useRef<{ cancel: () => void } | null>(null)

    useEffect(() => {
      return () => {
        staleCheckHandle.current?.cancel()
      }
    }, [])

    const handlePageSettled = useCallback(
      (wv: WebviewElement) => {
        staleCheckHandle.current?.cancel()
        if (!initialUrl) return

        let cancelled = false
        let pendingTimeout: ReturnType<typeof setTimeout> | null = null
        staleCheckHandle.current = {
          cancel: () => {
            cancelled = true
            if (pendingTimeout !== null) {
              clearTimeout(pendingTimeout)
              pendingTimeout = null
            }
          }
        }

        let checks = 0
        const maxChecks = 7

        const runCheck = async () => {
          if (cancelled || checks >= maxChecks) return
          checks++

          try {
            const currentUrl = wv.getURL?.()
            if (!currentUrl) return

            const c = new URL(currentUrl)
            const b = new URL(initialUrl)
            if (
              c.origin === b.origin &&
              c.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '')
            )
              return

            const isStale = await wv.executeJavaScript(STALE_CONTENT_DETECTION_SCRIPT)
            if (isStale) {
              cancelled = true
              wv.loadURL?.(initialUrl)
              return
            }
          } catch {
            /* webview may have been destroyed */
          }

          if (!cancelled && checks < maxChecks) {
            pendingTimeout = setTimeout(runCheck, STALE_CONTENT_CHECK_DELAY_MS)
          }
        }

        pendingTimeout = setTimeout(runCheck, STALE_CONTENT_CHECK_DELAY_MS)
      },
      [initialUrl]
    )

    const { isLoading, error, onWebviewRef, handleRetry } = useWebviewLifecycle({
      currentAI: tab.modelId,
      registerWebview: registerInstance,
      t,
      showWarning,
      onUrlChange: onTabUrlRecorded ? reportNavigationUrl : undefined,
      onPageSettled: handlePageSettled
    })
    const partition = useMemo(() => {
      if (!siteConfig) return 'persist:ai_session'
      if (siteConfig.partition) return siteConfig.partition
      if (siteConfig.isSite) return `temp_${tab.modelId}_${tab.id}`
      return 'persist:ai_session'
    }, [siteConfig, tab.id, tab.modelId])

    const canRenderWebview = Boolean(siteConfig) && !isSleeping

    const webview = useMemo(() => {
      if (!canRenderWebview) return null

      return (
        <webview
          key={tab.modelId}
          ref={onWebviewRef}
          src={webviewSrc}
          partition={partition}
          className="flex-1 w-full h-full"
          allowpopups={WEBVIEW_ALLOW_POPUPS}
          webpreferences="contextIsolation=yes, sandbox=yes, backgroundThrottling=yes"
          useragent={chromeUserAgent}
        />
      )
    }, [canRenderWebview, chromeUserAgent, webviewSrc, onWebviewRef, partition, tab.modelId])

    return (
      <div
        className="absolute inset-0 flex flex-col"
        style={{
          visibility: isActive ? 'visible' : 'hidden',
          zIndex: isActive ? 1 : 0
        }}
      >
        <div className="flex-1 relative flex flex-col">
          {isSleeping ? (
            <div
              onClick={handleWakeUp}
              className="flex-1 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer select-none"
            >
              <div className="p-4 rounded-2xl bg-zinc-800/80 mb-4 border border-zinc-700/50 shadow-xl transition-transform hover:scale-105 active:scale-95">
                <svg
                  className="w-8 h-8 text-zinc-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              </div>
              <p className="text-zinc-200 font-medium text-ql-20">Oturum Uyku Modunda</p>
              <p className="text-ql-14 text-zinc-500 mt-1 max-w-sm text-center">
                Bellek tüketimini azaltmak için sekme uyutuldu. Kaldığınız yerden devam etmek ve
                belleği tazelemek için tıklayın.
              </p>
            </div>
          ) : (
            webview
          )}

          {/* Mouse Catcher: Prevents webview from swallowing mouse events when bar is hovered */}
          {isBarHovered && isActive && !isSleeping && (
            <div className="absolute inset-0 z-[5] pointer-events-auto bg-transparent" />
          )}

          {isLoading && isActive && !isSleeping && <AestheticLoader />}

          {error && isActive && !isSleeping && (
            <AiErrorView error={error} onRetry={handleRetry} aiName={siteConfig?.displayName} />
          )}
        </div>
      </div>
    )
  }
)

AiSession.displayName = 'AiSession'

export default AiSession

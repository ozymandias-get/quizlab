import { useMemo, memo, useCallback, useState, useEffect } from 'react'
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
import type { WebviewController } from '@shared-core/types/webview'
import AiErrorView from './AiErrorView'

interface AiSessionProps {
  tab: Tab
  isActive: boolean
  isBarHovered: boolean
}

/**
 * Single AI Session (Webview)
 */
const AiSession = memo(({ tab, isActive, isBarHovered }: AiSessionProps) => {
  const { chromeUserAgent } = useAiRegistryMeta()
  const { aiSites } = useAiModelsCatalog()
  const { registerWebview } = useAiWebviewHostActions()
  const { showWarning } = useToastActions()
  const { t } = useLanguageStrings()

  const [isSleeping, setIsSleeping] = useState(false)

  // Hibernate the webview after 15 minutes of inactivity to save RAM
  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (!isActive) {
      timeout = setTimeout(
        () => {
          setIsSleeping(true)
        },
        15 * 60 * 1000
      )
    } else {
      setIsSleeping(false)
    }
    return () => clearTimeout(timeout)
  }, [isActive])

  const handleWakeUp = useCallback(() => {
    setIsSleeping(false)
  }, [])

  const registerInstance = useCallback(
    (instance: WebviewController | null) => {
      registerWebview(tab.id, instance)
    },
    [registerWebview, tab.id]
  )

  const { isLoading, error, onWebviewRef, handleRetry } = useWebviewLifecycle({
    currentAI: tab.modelId,
    registerWebview: registerInstance,
    t,
    showWarning
  })

  const siteConfig = aiSites[tab.modelId]
  const initialUrl = siteConfig?.url
  const partition = useMemo(() => {
    if (!siteConfig) return 'persist:ai_session'
    if (siteConfig.partition) return siteConfig.partition
    if (siteConfig.isSite) return `temp_${tab.modelId}_${tab.id}`
    return 'persist:ai_session'
  }, [siteConfig, tab.id, tab.modelId])

  const webview = useMemo(() => {
    if (!siteConfig || isSleeping) return null

    return (
      <webview
        key={tab.modelId}
        ref={onWebviewRef}
        src={initialUrl}
        partition={partition}
        className="flex-1 w-full h-full"
        allowpopups={WEBVIEW_ALLOW_POPUPS}
        webpreferences="contextIsolation=yes, sandbox=yes, backgroundThrottling=yes"
        useragent={chromeUserAgent}
      />
    )
  }, [chromeUserAgent, initialUrl, isSleeping, onWebviewRef, partition, siteConfig, tab.modelId])

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
})

AiSession.displayName = 'AiSession'

export default AiSession

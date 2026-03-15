import { useMemo, memo, useCallback } from 'react'
import { useToast, useLanguage } from '@app/providers'
import { useAiActions, useAiState } from '@app/providers/AiContext'
import type { Tab } from '@app/providers/AiContext'
import AestheticLoader from '@ui/components/AestheticLoader'
import { useWebviewLifecycle } from '@shared/hooks/webview/useWebviewLifecycle'
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
  const { aiSites, chromeUserAgent } = useAiState()
  const { registerWebview } = useAiActions()
  const { showWarning } = useToast()
  const { t } = useLanguage()

  const registerInstance = useCallback(
    (instance: any) => {
      registerWebview(tab.id, instance)
    },
    [registerWebview, tab.id]
  )

  // Use custom hook for lifecycle logic
  const { isLoading, error, onWebviewRef, handleRetry } = useWebviewLifecycle({
    currentAI: tab.modelId, // Pass the tab's model ID
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
    if (!siteConfig) return null

    return (
      <webview
        key={tab.modelId} // Reset webview if model changes in this tab
        ref={onWebviewRef}
        src={initialUrl}
        partition={partition}
        className="flex-1 w-full h-full"
        allowpopups={'true' as any}
        webpreferences="contextIsolation=yes, sandbox=yes"
        useragent={chromeUserAgent}
      />
    )
  }, [chromeUserAgent, initialUrl, onWebviewRef, partition, siteConfig, tab.modelId])

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{
        visibility: isActive ? 'visible' : 'hidden',
        zIndex: isActive ? 1 : 0
      }}
    >
      <div className="flex-1 relative flex flex-col">
        {webview}

        {/* Mouse Catcher: Prevents webview from swallowing mouse events when bar is hovered */}
        {isBarHovered && isActive && (
          <div className="absolute inset-0 z-[5] pointer-events-auto bg-transparent" />
        )}

        {isLoading && isActive && <AestheticLoader />}

        {error && isActive && (
          <AiErrorView error={error} onRetry={handleRetry} aiName={siteConfig?.displayName} />
        )}
      </div>
    </div>
  )
})

AiSession.displayName = 'AiSession'

export default AiSession

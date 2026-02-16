import { useMemo, memo, useCallback } from 'react'
import { useAi, useToast, useLanguage } from '@src/app/providers'
import type { Tab } from '@src/app/providers/AiContext'
import AestheticLoader from '@src/components/ui/AestheticLoader'
import { useWebviewLifecycle } from '@src/hooks/webview/useWebviewLifecycle'
import AiErrorView from './AiErrorView'

interface AiSessionProps {
    tab: Tab;
    isActive: boolean;
    isBarHovered: boolean;
}

/**
 * Single AI Session (Webview)
 */
const AiSession = memo(({ tab, isActive, isBarHovered }: AiSessionProps) => {
    const { aiSites, registerWebview, chromeUserAgent } = useAi()
    const { showWarning } = useToast()
    const { t } = useLanguage()

    const registerInstance = useCallback((instance: any) => {
        registerWebview(tab.id, instance)
    }, [registerWebview, tab.id])

    // Use custom hook for lifecycle logic
    const {
        isLoading,
        error,
        onWebviewRef,
        handleRetry
    } = useWebviewLifecycle({
        currentAI: tab.modelId, // Pass the tab's model ID
        registerWebview: registerInstance,
        t,
        showWarning
    })

    const siteConfig = aiSites[tab.modelId]
    const initialUrl = siteConfig?.url

    const webview = useMemo(() => {
        if (!siteConfig) return null

        return (
            <webview
                key={tab.modelId} // Reset webview if model changes in this tab
                ref={onWebviewRef}
                src={initialUrl}
                partition={siteConfig?.partition || "persist:ai_session"}
                className="flex-1 w-full h-full"
                allowpopups={"true" as any}
                webpreferences="contextIsolation=yes, sandbox=no"
                useragent={chromeUserAgent}
            />
        )
    }, [initialUrl, onWebviewRef, siteConfig, chromeUserAgent, tab.modelId])

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

                {isLoading && isActive && (
                    <AestheticLoader />
                )}

                {error && isActive && (
                    <AiErrorView
                        error={error}
                        onRetry={handleRetry}
                        aiName={siteConfig?.displayName}
                    />
                )}
            </div>
        </div>
    )
})

AiSession.displayName = 'AiSession'

export default AiSession

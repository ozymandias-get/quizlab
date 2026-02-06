import { useMemo, memo } from 'react'
import { useAi, useToast, useLanguage } from '@src/app/providers'

import AestheticLoader from '@src/components/ui/AestheticLoader'
import { useWebviewLifecycle } from '@src/hooks/webview/useWebviewLifecycle'
import MagicSelectorTutorial from '@src/features/tutorial/components/MagicSelectorTutorial'

interface AiWebviewProps {
    isResizing: boolean;
    isBarHovered: boolean;
}

/**
 * AI Webview Component (Optimized)
 * 
 * Creates a webview for the active AI platform.
 */
function AiWebview({ isResizing, isBarHovered }: AiWebviewProps) {
    const { currentAI, aiSites, registerWebview, chromeUserAgent, isTutorialActive, stopTutorial } = useAi()
    const { showWarning } = useToast()
    const { t } = useLanguage()

    // Use custom hook for lifecycle logic
    const {
        isLoading,
        error,
        onWebviewRef,
        handleRetry
    } = useWebviewLifecycle({
        currentAI,
        registerWebview,
        t,
        showWarning
    })

    const siteConfig = aiSites[currentAI]
    const initialUrl = siteConfig?.url

    const webview = useMemo(() => {
        if (!siteConfig) return null

        return (
            <webview
                key={currentAI}
                ref={onWebviewRef}
                src={initialUrl}
                partition={siteConfig?.partition || "persist:ai_session"}
                className="flex-1 w-full h-full"
                allowpopups={"true" as any}
                webpreferences="contextIsolation=yes, sandbox=no"
                useragent={chromeUserAgent}
            />
        )
    }, [initialUrl, onWebviewRef, siteConfig, chromeUserAgent])

    return (
        <div className="flex flex-col flex-1 relative overflow-hidden bg-[#050505] m-3 rounded-[1.5rem] shadow-2xl"
            style={{
                pointerEvents: isResizing ? 'none' : 'auto',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                clipPath: 'inset(0 round 1.5rem)' // Force proper clipping of Webview
            }}
        >
            {/* Border Overlay - Covers anti-aliasing artifacts */}
            <div className="absolute inset-0 rounded-[1.5rem] border border-white/[0.08] pointer-events-none z-50" />

            <div className="flex-1 relative">
                {webview}

                {/* Mouse Catcher: Prevents webview from swallowing mouse events when bar is hovered */}
                {isBarHovered && (
                    <div className="absolute inset-0 z-[5] pointer-events-auto bg-transparent" />
                )}

                {isLoading && (
                    <AestheticLoader />
                )}

                {error && (
                    <div className="absolute inset-0 bg-stone-900/95 backdrop-blur-sm flex items-center justify-center z-10 animate-in fade-in zoom-in duration-300">
                        <div className="flex flex-col items-center text-center gap-5 p-10 max-w-xs">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                <svg className="text-red-400/80" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 8v4" />
                                    <circle cx="12" cy="16" r="0.5" fill="currentColor" />
                                </svg>
                            </div>
                            <h3 className="font-display text-xl font-semibold text-stone-200">
                                {t('ai_error_title', { name: siteConfig?.displayName || 'AI' })}
                            </h3>
                            <p className="text-stone-500 text-sm leading-relaxed">{error}</p>
                            <button className="btn-secondary flex items-center gap-2 mt-2 px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 transition-colors" onClick={handleRetry}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M23 4v6h-6" />
                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                </svg>
                                <span>{t('try_again')}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>


            {/* Tutorial Simulation */}
            {isTutorialActive && (
                <div className="absolute inset-0 z-[100] bg-black">
                    <MagicSelectorTutorial
                        onClose={stopTutorial}
                        onComplete={() => {
                            stopTutorial()
                        }}
                    />
                </div>
            )}
        </div>
    )
}

export default memo(AiWebview)


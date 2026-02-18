import { memo } from 'react'
import { useAi } from '@src/app/providers'
import MagicSelectorTutorial from '@features/tutorial/components/MagicSelectorTutorial'
import AiSession from './AiSession'

interface AiWebviewProps {
    isResizing: boolean;
    isBarHovered: boolean;
}

/**
 * AI Webview Component (Optimized)
 * 
 * Creates webviews for active AI tabs.
 */
function AiWebview({ isResizing, isBarHovered }: AiWebviewProps) {
    const { tabs, activeTabId, isTutorialActive, stopTutorial } = useAi()

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

            {/* Render all tabs */}
            {tabs.map(tab => (
                <AiSession
                    key={tab.id}
                    tab={tab}
                    isActive={tab.id === activeTabId}
                    isBarHovered={isBarHovered}
                />
            ))}

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


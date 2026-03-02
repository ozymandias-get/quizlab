import { memo, useEffect, useState } from 'react'
import { useAi } from '@app/providers'
import { MagicSelectorTutorial } from '@features/tutorial'
import AiSession from './AiSession'
import AiTabStrip from './AiTabStrip'

interface AiWebviewProps {
    isResizing: boolean;
    isBarHovered: boolean;
}

// Memory optimization: How many unpinned tabs to keep mounted in background.
// Unmounting older inactive tabs frees up significant RAM/CPU.
const MAX_ALIVE_UNPINNED_TABS = 3

/**
 * AI Webview Component (Optimized)
 *
 * Creates webviews for active AI tabs.
 */
function AiWebview({ isResizing, isBarHovered }: AiWebviewProps) {
    const { tabs, activeTabId, isTutorialActive, stopTutorial } = useAi()
    const [aliveTabIds, setAliveTabIds] = useState<string[]>(activeTabId ? [activeTabId] : [])

    // Update the LRU cache of alive tabs whenever active tab changes
    useEffect(() => {
        if (!activeTabId) return

        setAliveTabIds(prev => {
            const filtered = prev.filter(id => id !== activeTabId)
            const next = [activeTabId, ...filtered]
            return next.slice(0, MAX_ALIVE_UNPINNED_TABS)
        })
    }, [activeTabId])

    // Cleanup aliveTabIds when tabs are closed
    useEffect(() => {
        const currentTabIds = new Set(tabs.map(t => t.id))
        setAliveTabIds(prev => prev.filter(id => currentTabIds.has(id)))
    }, [tabs])

    return (
        <div
            className="flex flex-col flex-1 relative overflow-hidden bg-[#050505] m-3 rounded-[1.5rem] shadow-2xl"
            style={{
                pointerEvents: isResizing ? 'none' : 'auto',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                clipPath: 'inset(0 round 1.5rem)' // Force proper clipping of Webview
            }}
        >
            {/* Border Overlay - Covers anti-aliasing artifacts */}
            <div className="absolute inset-0 rounded-[1.5rem] border border-white/[0.08] pointer-events-none z-50" />

            <AiTabStrip />

            <div className="relative flex-1 min-h-0">
                {/* Render tabs based on hibernation strategy */}
                {tabs.map((tab) => {
                    const isMounted = tab.pinned || tab.id === activeTabId || aliveTabIds.includes(tab.id)

                    // Hibernate (unmount) to save RAM/CPU
                    if (!isMounted) return null

                    return (
                        <AiSession
                            key={tab.id}
                            tab={tab}
                            isActive={tab.id === activeTabId}
                            isBarHovered={isBarHovered}
                        />
                    )
                })}
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


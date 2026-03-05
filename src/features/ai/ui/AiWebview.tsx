import { memo, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAi } from '@app/providers'
import { MagicSelectorTutorial } from '@features/tutorial'
import AiSession from './AiSession'
import AiTabStrip from './AiTabStrip'
import AiHomePage from './AiHomePage'

interface AiWebviewProps {
    isResizing: boolean
    isBarHovered: boolean
}

// Memory optimization: How many unpinned tabs to keep mounted in background.
// Unmounting older inactive tabs frees up significant RAM/CPU.
const MAX_ALIVE_UNPINNED_TABS = 3

/**
 * AI Webview Component (Optimized)
 *
 * Creates webviews for active AI tabs. Shows AiHomePage on startup.
 */
function AiWebview({ isResizing, isBarHovered }: AiWebviewProps) {
    const { tabs, activeTabId, setActiveTab, addTab, isTutorialActive, stopTutorial } = useAi()
    const [aliveTabIds, setAliveTabIds] = useState<string[]>(activeTabId ? [activeTabId] : [])
    const [showHome, setShowHome] = useState(true)

    // Auto-show home when no tabs exist or activeTabId is cleared
    useEffect(() => {
        if (tabs.length === 0 || !activeTabId) {
            setShowHome(true)
        }
    }, [tabs.length, activeTabId])

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

    const handleSelectTab = (tabId: string) => {
        setActiveTab(tabId)
        setShowHome(false)
    }

    const handleOpenModel = (modelId: string) => {
        // If there's already a tab with this model, just switch to it
        const existing = tabs.find(t => t.modelId === modelId)
        if (existing) {
            setActiveTab(existing.id)
        } else {
            addTab(modelId)
        }
        setShowHome(false)
    }

    return (
        <div
            className={`flex flex-col flex-1 relative overflow-hidden m-3 rounded-[1.5rem] shadow-2xl transition-colors duration-500 ${showHome ? 'bg-black/40 backdrop-blur-xl' : 'bg-[#050505]'}`}
            style={{
                pointerEvents: isResizing ? 'none' : 'auto',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                clipPath: 'inset(0 round 1.5rem)' // Force proper clipping of Webview
            }}
        >
            {/* Border Overlay - Covers anti-aliasing artifacts */}
            <div className="absolute inset-0 rounded-[1.5rem] border border-white/[0.08] pointer-events-none z-50" />

            <AiTabStrip
                showHome={showHome}
                onShowHome={() => setShowHome(true)}
                onHideHome={() => setShowHome(false)}
            />

            <div className="relative flex-1 min-h-0">
                {/* Home Page */}
                <AnimatePresence>
                    {showHome && (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="absolute inset-0 z-10"
                        >
                            <AiHomePage
                                onSelectTab={handleSelectTab}
                                onOpenModel={handleOpenModel}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Render tabs based on hibernation strategy */}
                {tabs.map((tab) => {
                    const isMounted = tab.pinned || tab.id === activeTabId || aliveTabIds.includes(tab.id)

                    // Hibernate (unmount) to save RAM/CPU
                    if (!isMounted) return null

                    return (
                        <AiSession
                            key={tab.id}
                            tab={tab}
                            isActive={tab.id === activeTabId && !showHome}
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

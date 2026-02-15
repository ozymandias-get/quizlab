import React, { memo, useState, useCallback } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { useAi, useLanguage } from '@src/app/providers'
import { AIItem } from './AIItem'
import { panelVariantsVertical, panelTransition } from './animations'

interface ModelsPanelProps {
    isOpen: boolean;
    panelStyle: React.CSSProperties;
    showOnlyIcons: boolean;
}

export const ModelsPanel = memo(({ isOpen, panelStyle, showOnlyIcons }: ModelsPanelProps) => {
    const {
        tabs,
        activeTabId,
        setActiveTab,
        addTab,
        closeTab, // Add this
        enabledModels,
        setEnabledModels,
        aiSites
    } = useAi()

    const { t } = useLanguage()

    const [activeDragItem, setActiveDragItem] = useState<string | null>(null)

    const handleReorder = useCallback((newOrder: string[]) => {
        setEnabledModels(newOrder)
    }, [setEnabledModels])

    return (
        <AnimatePresence initial={false}>
            {isOpen && (
                <motion.div
                    variants={panelVariantsVertical}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={panelTransition}
                    className="bottom-bar-panel bottom-bar-panel--models absolute top-full mt-2 left-0 w-full overflow-hidden flex flex-col gap-4 py-4 rounded-2xl border border-white/20 shadow-2xl shadow-black/50 bg-[#080808]/95 backdrop-blur-xl"
                    style={panelStyle}
                    id="bottom-bar-models-list"
                >
                    {/* SECTION 1: ACTIVE TABS */}
                    {tabs.length > 0 && (
                        <div className="flex flex-col items-center gap-1 w-full relative z-10 px-0.5">
                            <div className="text-[10px] font-bold text-white/90 tracking-widest leading-none select-none text-center w-full whitespace-nowrap drop-shadow-sm uppercase antialiased">
                                {t('open_tabs')}
                            </div>

                            {/* Tabs are not draggable in this implementation */}
                            <div className="flex flex-col items-center gap-1 w-full">
                                {tabs.map((tab) => {
                                    const site = aiSites[tab.modelId];
                                    if (!site) return null;
                                    return (
                                        <div key={tab.id} onContextMenu={(e) => {
                                            e.preventDefault();
                                            // Handle close
                                            if (closeTab) closeTab(tab.id);
                                        }}>
                                            <AIItem
                                                modelKey={tab.modelId} // Visual Model
                                                site={site}
                                                isSelected={tab.id === activeTabId}
                                                setCurrentAI={() => setActiveTab(tab.id)} // Switch Tab
                                                setActiveDragItem={() => { }} // No drag for tabs
                                                activeDragItem={null}
                                                showOnlyIcons={showOnlyIcons}
                                                draggable={false} // Disable drag for tabs
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* DIVIDER */}
                    {tabs.length > 0 && (
                        <div className="w-[60%] h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto" />
                    )}

                    {/* SECTION 2: NEW TAB (Available Models) */}
                    <div className="flex flex-col items-center gap-1 w-full relative z-10 px-0.5">
                        <div className="text-[10px] font-bold text-white/90 tracking-widest leading-none select-none text-center w-full whitespace-nowrap drop-shadow-sm uppercase antialiased">
                            {t('new_tab')}
                        </div>

                        <Reorder.Group
                            axis="y"
                            values={enabledModels}
                            onReorder={handleReorder}
                            className="flex flex-col items-center gap-1 w-full"
                        >
                            {enabledModels.map((modelKey, index) => {
                                const site = aiSites[modelKey]
                                if (!site) return null

                                return (
                                    <AIItem
                                        key={modelKey}
                                        modelKey={modelKey}
                                        site={site}
                                        isSelected={false} // Always false for "New Tab" items
                                        setCurrentAI={addTab} // CREATE NEW TAB
                                        setActiveDragItem={setActiveDragItem}
                                        activeDragItem={activeDragItem}
                                        showOnlyIcons={showOnlyIcons}
                                        animationDelay={0.03 + (index * 0.03)}
                                        draggable={true}
                                    />
                                )
                            })}
                        </Reorder.Group>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
})

ModelsPanel.displayName = 'ModelsPanel'

import React, { memo, useState, useCallback } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { useAi } from '@app/providers'
import { AIItem } from './AIItem'
import { panelVariantsVertical, panelTransition } from './animations'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

interface ModelsPanelProps {
    isOpen: boolean;
    panelStyle: React.CSSProperties;
    maxHeight?: number;
    showOnlyIcons: boolean;
}

export const ModelsPanel = memo(({ isOpen, panelStyle, maxHeight, showOnlyIcons }: ModelsPanelProps) => {
    const {
        addTab,
        enabledModels,
        setEnabledModels,
        aiSites
    } = useAi()

    const [activeDragItem, setActiveDragItem] = useState<string | null>(null)

    const handleReorder = useCallback((newOrder: string[]) => {
        setEnabledModels(newOrder)
    }, [setEnabledModels])

    const resolvedMaxHeight = maxHeight ? `${Math.max(0, Math.floor(maxHeight))}px` : 'min(52vh, 24rem)'

    return (
        <AnimatePresence initial={false}>
            {isOpen && (
                <motion.div
                    variants={panelVariantsVertical}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={panelTransition}
                    className="bottom-bar-panel bottom-bar-panel--models absolute top-full mt-2 left-0 z-40 w-full overflow-hidden rounded-2xl border border-white/20 shadow-2xl shadow-black/50 bg-[#080808]/95 backdrop-blur-xl"
                    style={{
                        ...panelStyle,
                        maxHeight: resolvedMaxHeight
                    }}
                    id={APP_CONSTANTS.TOUR_TARGETS.MODELS_LIST}
                >
                    <div className="relative flex flex-col items-center w-full">
                        <div
                            data-testid="models-panel-scroll-area"
                            className="w-full overflow-y-auto overflow-x-hidden scrollbar-hidden overscroll-contain"
                            style={{ maxHeight: resolvedMaxHeight }}
                        >
                            <Reorder.Group
                                axis="y"
                                values={enabledModels}
                                onReorder={handleReorder}
                                className="flex flex-col items-center gap-2 py-3 w-full"
                            >
                                {enabledModels.map((modelKey, index) => {
                                    const site = aiSites[modelKey]
                                    if (!site) return null

                                    return (
                                        <AIItem
                                            key={modelKey}
                                            modelKey={modelKey}
                                            site={site}
                                            isSelected={false}
                                            setCurrentAI={addTab}
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
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
})

ModelsPanel.displayName = 'ModelsPanel'

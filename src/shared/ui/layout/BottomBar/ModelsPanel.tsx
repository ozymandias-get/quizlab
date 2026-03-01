import React, { memo, useState, useCallback } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { useAi, useLanguage } from '@app/providers'
import { AIItem } from './AIItem'
import { panelVariantsVertical, panelTransition } from './animations'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

interface ModelsPanelProps {
    isOpen: boolean;
    panelStyle: React.CSSProperties;
    showOnlyIcons: boolean;
}

export const ModelsPanel = memo(({ isOpen, panelStyle, showOnlyIcons }: ModelsPanelProps) => {
    const {
        addTab,
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
                    className="bottom-bar-panel bottom-bar-panel--models absolute top-full mt-2 left-0 z-40 w-full overflow-visible flex flex-col gap-4 py-4 rounded-2xl border border-white/20 shadow-2xl shadow-black/50 bg-[#080808]/95 backdrop-blur-xl"
                    style={panelStyle}
                    id={APP_CONSTANTS.TOUR_TARGETS.MODELS_LIST}
                >
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
                </motion.div>
            )}
        </AnimatePresence>
    )
})

ModelsPanel.displayName = 'ModelsPanel'


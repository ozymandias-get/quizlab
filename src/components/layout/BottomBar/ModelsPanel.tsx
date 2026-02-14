import React, { memo, useState, useCallback } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { useAi } from '@src/app/providers'
import { AIItem } from './AIItem'
import { panelVariantsVertical, panelTransition } from './animations'

interface ModelsPanelProps {
    isOpen: boolean;
    panelStyle: React.CSSProperties;
    showOnlyIcons: boolean;
}

export const ModelsPanel = memo(({ isOpen, panelStyle, showOnlyIcons }: ModelsPanelProps) => {
    const { currentAI, setCurrentAI, enabledModels, setEnabledModels, aiSites } = useAi()
    const [activeDragItem, setActiveDragItem] = useState<string | null>(null)

    const handleReorder = useCallback((newOrder: string[]) => {
        setEnabledModels(newOrder)
    }, [setEnabledModels])

    const aiModels = enabledModels

    return (
        <AnimatePresence initial={false}>
            {isOpen && (
                <motion.div
                    variants={panelVariantsVertical}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={panelTransition}
                    className="bottom-bar-panel bottom-bar-panel--models absolute top-full mt-1.5 left-0 w-full overflow-hidden"
                    style={panelStyle}
                    id="bottom-bar-models-list"
                >
                    <motion.div
                        className="flex flex-col items-center gap-2 py-3 w-full"
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={{
                            hidden: {},
                            visible: {
                                transition: {
                                    staggerChildren: 0.04,
                                    delayChildren: 0.1,
                                }
                            },
                            exit: {
                                transition: {
                                    staggerChildren: 0.025,
                                    staggerDirection: -1,
                                }
                            }
                        }}
                    >
                        <Reorder.Group
                            axis="y"
                            values={aiModels}
                            onReorder={handleReorder}
                            className="flex flex-col items-center gap-1"
                        >
                            {aiModels.map((modelKey, index) => {
                                const site = aiSites[modelKey]
                                if (!site) return null
                                return (
                                    <AIItem
                                        key={modelKey}
                                        modelKey={modelKey}
                                        site={site}
                                        isSelected={currentAI === modelKey}
                                        setCurrentAI={setCurrentAI}
                                        setActiveDragItem={setActiveDragItem}
                                        activeDragItem={activeDragItem}
                                        showOnlyIcons={showOnlyIcons}
                                        animationDelay={0.03 + (index * 0.03)}
                                    />
                                )
                            })}
                        </Reorder.Group>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
})

ModelsPanel.displayName = 'ModelsPanel'

import React, { memo, useState, useCallback } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { useAi } from '../../context'
import { AIItem } from './AIItem'
import { panelVariantsHorizontal, panelVariantsVertical, panelTransition } from './animations'

interface ModelsPanelProps {
    isOpen: boolean;
    bottomBarLayout: 'horizontal' | 'vertical';
    panelStyle: React.CSSProperties;
    showOnlyIcons: boolean;
}

export const ModelsPanel = memo(({ isOpen, bottomBarLayout, panelStyle, showOnlyIcons }: ModelsPanelProps) => {
    const { currentAI, setCurrentAI, enabledModels, setEnabledModels, aiSites } = useAi()
    const [activeDragItem, setActiveDragItem] = useState<string | null>(null)

    const handleReorder = useCallback((newOrder: string[]) => {
        setEnabledModels(newOrder)
    }, [setEnabledModels])

    const aiModels = enabledModels

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    variants={bottomBarLayout === 'vertical' ? panelVariantsVertical : panelVariantsHorizontal}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={panelTransition}
                    className={bottomBarLayout === 'vertical'
                        ? "absolute top-full mt-3 left-0 overflow-hidden w-[52px]"
                        : "absolute left-full ml-3 top-0 overflow-hidden h-[52px]"
                    }
                    style={panelStyle}
                    id="bottom-bar-models-list"
                >
                    <div className={bottomBarLayout === 'vertical'
                        ? "flex flex-col items-center gap-1 py-3 w-full"
                        : "flex items-center gap-1 px-3 h-full"
                    }>
                        <Reorder.Group
                            axis={bottomBarLayout === 'vertical' ? 'y' : 'x'}
                            values={aiModels}
                            onReorder={handleReorder}
                            className={bottomBarLayout === 'vertical'
                                ? "flex flex-col items-center gap-1"
                                : "flex items-center gap-1"
                            }
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
                                        animationDelay={0.03 + (index * 0.02)}
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

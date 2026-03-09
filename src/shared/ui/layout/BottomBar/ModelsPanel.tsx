import React, { memo, useState, useCallback } from 'react'
import { Reorder } from 'framer-motion'
import { useAiActions, useAiState } from '@app/providers/AiContext'
import { AIItem } from './AIItem'
import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { BottomBarPanelFrame } from './BottomBarPanelFrame'

interface ModelsPanelProps {
    isOpen: boolean;
    panelStyle: React.CSSProperties;
    maxHeight?: number;
    showOnlyIcons: boolean;
}

export const ModelsPanel = memo(({ isOpen, panelStyle, maxHeight, showOnlyIcons }: ModelsPanelProps) => {
    const { enabledModels, aiSites } = useAiState()
    const { addTab, setEnabledModels } = useAiActions()

    const [activeDragItem, setActiveDragItem] = useState<string | null>(null)

    const handleReorder = useCallback((newOrder: string[]) => {
        setEnabledModels(newOrder)
    }, [setEnabledModels])

    return (
        <BottomBarPanelFrame
            isOpen={isOpen}
            panelStyle={panelStyle}
            maxHeight={maxHeight}
            fallbackMaxHeight="min(52vh, 24rem)"
            className="bottom-bar-panel bottom-bar-panel--models absolute top-full mt-2 left-0 z-40 w-full overflow-hidden rounded-2xl border border-white/20 shadow-2xl shadow-black/50 bg-[#080808]/95 backdrop-blur-xl"
            id={APP_CONSTANTS.TOUR_TARGETS.MODELS_LIST}
            scrollAreaTestId="models-panel-scroll-area"
            scrollCueTestId="models-panel-scroll-cue"
        >
            <Reorder.Group
                axis="y"
                values={enabledModels}
                onReorder={handleReorder}
                className="flex flex-col items-center gap-2 py-3 w-full"
            >
                {enabledModels.map((modelKey) => {
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
                            draggable={true}
                        />
                    )
                })}
            </Reorder.Group>
        </BottomBarPanelFrame>
    )
})

ModelsPanel.displayName = 'ModelsPanel'

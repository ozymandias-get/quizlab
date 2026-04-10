import { memo, useState, useCallback, type CSSProperties } from 'react'
import { Reorder } from 'framer-motion'
import { useAiModelsCatalog, useAiCoreWorkspaceActions } from '@app/providers/AiContext'
import { AIItem } from './AIItem'
import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { BottomBarPanelFrame } from './BottomBarPanelFrame'

interface ModelsPanelProps {
  isOpen: boolean
  panelStyle: CSSProperties
  maxHeight?: number
  showOnlyIcons: boolean
}

export const ModelsPanel = memo(
  ({ isOpen, panelStyle, maxHeight, showOnlyIcons }: ModelsPanelProps) => {
    const { enabledModels, aiSites } = useAiModelsCatalog()
    const { addTab, setEnabledModels } = useAiCoreWorkspaceActions()

    const [activeDragItem, setActiveDragItem] = useState<string | null>(null)

    const handleReorder = useCallback(
      (newOrder: string[]) => {
        setEnabledModels(newOrder)
      },
      [setEnabledModels]
    )

    return (
      <BottomBarPanelFrame
        isOpen={isOpen}
        panelStyle={panelStyle}
        maxHeight={maxHeight}
        fallbackMaxHeight="min(52vh, 24rem)"
        className="glass-tier-2 bottom-bar-panel bottom-bar-panel--models absolute top-full mt-2 left-0 z-40 w-full overflow-hidden"
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
  }
)

ModelsPanel.displayName = 'ModelsPanel'

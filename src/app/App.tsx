import React from 'react'
import { AnimatePresence, LayoutGroup } from 'framer-motion'
import { ScreenshotTool } from '@features/screenshot'
import { UsageAssistant } from '@features/tutorial'
import UpdateBanner from '@ui/components/UpdateBanner'
import AppBackground from '@ui/layout/AppBackground'
import ToastContainer from '@ui/components/Toast/ToastContainer'
import GeminiWebLoginOverlay from '@app/ui/GeminiWebLoginOverlay'
import AiSendComposer from '@app/ui/AiSendComposer'
import MainWorkspace from '@app/ui/MainWorkspace'
import { useAppShellState } from '@app/hooks/useAppShellState'
import { usePdfWorkspaceState } from '@app/hooks/usePdfWorkspaceState'

const App: React.FC = () => {
  const {
    appTools,
    update,
    appearance,
    animations,
    isWebviewMounted,
    panelResize,
    workspaceState,
    updateBanner,
    tour
  } = useAppShellState()

  const { t, leftPanelProps, rootDragHandlers } = usePdfWorkspaceState({
    isInteractionBlocked: workspaceState.isBarHovered || panelResize.isResizing
  })

  return (
    <LayoutGroup>
      <div
        className="h-screen w-screen overflow-hidden relative animate-app-enter"
        {...rootDragHandlers}
      >
        <AppBackground />

        <ToastContainer />

        <UpdateBanner
          updateAvailable={update.updateAvailable}
          updateInfo={update.updateInfo}
          isVisible={updateBanner.isVisible}
          onClose={updateBanner.close}
          t={t}
        />

        <AnimatePresence mode="wait" initial={false}>
          <MainWorkspace
            isLayoutSwapped={appearance.isLayoutSwapped}
            leftPanelWidth={panelResize.leftPanelWidth}
            leftPanelRef={panelResize.leftPanelRef as React.RefObject<HTMLDivElement>}
            resizerRef={panelResize.resizerRef as React.RefObject<HTMLDivElement>}
            containerVariants={animations.containerVariants}
            leftPanelVariants={animations.leftPanelVariants}
            rightPanelVariants={animations.rightPanelVariants}
            resizerVariants={animations.resizerVariants}
            gpuAcceleratedStyle={animations.gpuAcceleratedStyle}
            handleMouseDown={panelResize.handleMouseDown}
            isWebviewMounted={isWebviewMounted}
            isResizing={panelResize.isResizing}
            isBarHovered={workspaceState.isBarHovered}
            onBarHoverChange={workspaceState.setIsBarHovered}
            leftPanelProps={leftPanelProps}
          />
        </AnimatePresence>

        <GeminiWebLoginOverlay isVisible={appTools.isGeminiWebLoginInProgress} t={t} />

        {appTools.pendingAiItems.length > 0 && (
          <AiSendComposer
            items={appTools.pendingAiItems}
            autoSend={appTools.autoSend}
            onAutoSendChange={appTools.setAutoSend}
            onRemoveItem={appTools.removePendingAiItem}
            onClearAll={appTools.clearPendingAiItems}
            onSend={({ noteText, autoSend, forceAutoSend }) =>
              appTools.sendPendingAiItems({ promptText: noteText, autoSend, forceAutoSend })
            }
          />
        )}

        <ScreenshotTool
          isActive={appTools.isScreenshotMode}
          onCapture={appTools.handleCapture}
          onClose={appTools.closeScreenshot}
        />

        <UsageAssistant isActive={tour.isActive} onClose={tour.close} />
      </div>
    </LayoutGroup>
  )
}

export default App

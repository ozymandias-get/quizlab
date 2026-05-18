import type { RefObject } from 'react'
import { memo, lazy, Suspense } from 'react'
import { AnimatePresence, LayoutGroup } from 'framer-motion'
import AppBackground from '@ui/layout/AppBackground'
import ToastContainer from '@ui/components/Toast/ToastContainer'
import MainWorkspace from '@app/ui/MainWorkspace'

const ScreenshotTool = lazy(() =>
  import('@features/screenshot').then((m) => ({ default: m.ScreenshotTool }))
)
const UsageAssistant = lazy(() =>
  import('@features/tutorial').then((m) => ({ default: m.UsageAssistant }))
)
const UpdateBanner = lazy(() => import('@ui/components/UpdateBanner'))
const GeminiWebLoginOverlay = lazy(() => import('@app/ui/GeminiWebLoginOverlay'))
const AiSendComposer = lazy(() => import('@app/ui/AiSendComposer'))
import { useAppShellState } from '@app/hooks/useAppShellState'
import { usePdfWorkspaceState } from '@app/hooks/usePdfWorkspaceState'
import { useAppToolActions, useAppToolFlagsState, useAppToolQueueState } from '@app/providers'

function App() {
  const {
    update,
    isLayoutSwapped,
    animations,
    isWebviewMounted,
    panelResize,
    workspaceState,
    updateBanner,
    tour
  } = useAppShellState()

  const { t, leftPanelProps, rootDragHandlers } = usePdfWorkspaceState({
    isInteractionBlocked: workspaceState.isBarHovered || panelResize.isResizing,
    isPanelResizing: panelResize.isResizing
  })

  return (
    <LayoutGroup>
      <div
        className="h-screen w-screen overflow-hidden relative animate-app-enter"
        {...rootDragHandlers}
      >
        <AppBackground />

        <ToastContainer />

        <Suspense fallback={null}>
          <UpdateBanner
            updateAvailable={update.updateAvailable}
            updateInfo={update.updateInfo}
            isVisible={updateBanner.isVisible}
            onClose={updateBanner.close}
            t={t}
          />
        </Suspense>

        <AnimatePresence mode="wait" initial={false}>
          <MainWorkspace
            isLayoutSwapped={isLayoutSwapped}
            leftPanelWidth={panelResize.leftPanelWidth}
            leftPanelRef={panelResize.leftPanelRef as RefObject<HTMLDivElement>}
            resizerRef={panelResize.resizerRef as RefObject<HTMLDivElement>}
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

        <Suspense fallback={null}>
          <GeminiWebLoginLayer t={t} />
        </Suspense>

        <Suspense fallback={null}>
          <PendingAiSendLayer />
        </Suspense>

        <Suspense fallback={null}>
          <ScreenshotToolLayer />
        </Suspense>

        <Suspense fallback={null}>
          <UsageAssistant isActive={tour.isActive} onClose={tour.close} />
        </Suspense>
      </div>
    </LayoutGroup>
  )
}

const GeminiWebLoginLayer = memo(function GeminiWebLoginLayer({
  t
}: {
  t: (key: string, params?: Record<string, string>) => string
}) {
  const { isGeminiWebLoginInProgress, isGeminiWebSessionRefreshing } = useAppToolFlagsState()
  return (
    <GeminiWebLoginOverlay
      isVisible={isGeminiWebLoginInProgress || isGeminiWebSessionRefreshing}
      t={t}
    />
  )
})

const PendingAiSendLayer = memo(function PendingAiSendLayer() {
  const { pendingAiItems, autoSend } = useAppToolQueueState()
  const { setAutoSend, removePendingAiItem, clearPendingAiItems, sendPendingAiItems } =
    useAppToolActions()

  if (!pendingAiItems || pendingAiItems.length === 0) {
    return null
  }

  return (
    <AiSendComposer
      items={pendingAiItems}
      autoSend={autoSend}
      onAutoSendChange={setAutoSend}
      onRemoveItem={removePendingAiItem}
      onClearAll={clearPendingAiItems}
      onSend={({ noteText, autoSend: auto, forceAutoSend }) =>
        sendPendingAiItems({ promptText: noteText, autoSend: auto, forceAutoSend })
      }
    />
  )
})

const ScreenshotToolLayer = memo(function ScreenshotToolLayer() {
  const { isScreenshotMode } = useAppToolFlagsState()
  const { handleCapture, closeScreenshot } = useAppToolActions()

  return (
    <ScreenshotTool
      isActive={isScreenshotMode}
      onCapture={handleCapture}
      onClose={closeScreenshot}
    />
  )
})

export default App

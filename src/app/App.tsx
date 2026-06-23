import type { GeminiWebLoginOverlayMode } from '@app/ui/GeminiWebLoginOverlay'
import MainWorkspace from '@app/ui/MainWorkspace'
import { useAppearance } from '@shared/stores/appearanceStore'
import ToastContainer from '@ui/components/Toast/ToastContainer'
import AppBackground from '@ui/layout/AppBackground'

import { AnimatePresence, LayoutGroup } from 'motion/react'
import type { RefObject } from 'react'
import { lazy, memo, Suspense, useCallback, useMemo } from 'react'

const FocusOverlay = lazy(() => import('@app/ui/FocusOverlay'))
const ScreenshotTool = lazy(() =>
  import('@features/screenshot').then((m) => ({ default: m.ScreenshotTool }))
)
const TutorialOverlay = lazy(() =>
  import('@features/tutorial').then((m) => ({ default: m.TutorialOverlay }))
)
const UpdateBanner = lazy(() => import('@ui/components/UpdateBanner'))
const GeminiWebLoginOverlay = lazy(() => import('@app/ui/GeminiWebLoginOverlay'))
const AiSendComposer = lazy(() => import('@app/ui/AiSendComposer'))
import { useCacheThresholdWarning } from '@features/settings/hooks/useCacheThresholdWarning'
import { useTutorialStore } from '@features/tutorial/store/tutorialStore'
import { getTutorialEntry } from '@features/tutorial/tutorialRegistry'

import { useAppShellState } from '@app/hooks/useAppShellState'
import { usePdfWorkspaceState } from '@app/hooks/usePdfWorkspaceState'
import {
  useAppToolActions,
  useAppToolGeminiSessionState,
  useAppToolQueueState,
  useAppToolScreenshotState
} from '@app/providers'

function App() {
  // Önbellek boyutunu izle ve %80 eşiği aşılırsa uyarı göster (oturum başına bir kez)
  useCacheThresholdWarning()

  const {
    updateAvailable,
    updateInfo,
    isLayoutSwapped,
    animations,
    isWebviewMounted,
    panelResize,
    workspaceState,
    updateBanner,
    focus
  } = useAppShellState()

  const bgMode = useAppearance((state) => state.bgMode)

  const { t, leftPanelProps, readingProps, rootDragHandlers } = usePdfWorkspaceState({
    isInteractionBlocked: workspaceState.isBarHovered || panelResize.isResizing,
    isPanelResizing: panelResize.isResizing
  })

  const combinedLeftPanelProps = useMemo(
    () => ({ ...leftPanelProps, ...readingProps }),
    [leftPanelProps, readingProps]
  )
  const {
    leftPanelWidth,
    leftPanelRef,
    resizerRef,
    handleMouseDown,
    isResizing,
    setLeftPanelWidth
  } = panelResize
  const handleResizerDoubleClick = useCallback(() => {
    setLeftPanelWidth(50)
  }, [setLeftPanelWidth])

  const isFocusActive = focus.mode !== null

  return (
    <LayoutGroup>
      <div
        className="animate-app-enter relative h-screen w-screen overflow-hidden"
        {...rootDragHandlers}
      >
        <AppBackground />

        <ToastContainer />

        <Suspense fallback={null}>
          <UpdateBanner
            updateAvailable={updateAvailable}
            updateInfo={updateInfo}
            isVisible={updateBanner.isVisible && !isFocusActive}
            onClose={updateBanner.close}
            t={t}
          />
        </Suspense>

        <div
          className={isFocusActive ? 'pointer-events-none invisible absolute' : ''}
          aria-hidden={isFocusActive}
        >
          <MainWorkspace
            isLayoutSwapped={isLayoutSwapped}
            leftPanelWidth={leftPanelWidth}
            leftPanelRef={leftPanelRef as RefObject<HTMLDivElement>}
            resizerRef={resizerRef as RefObject<HTMLDivElement>}
            containerVariants={animations.containerVariants}
            leftPanelVariants={animations.leftPanelVariants}
            rightPanelVariants={animations.rightPanelVariants}
            resizerVariants={animations.resizerVariants}
            gpuAcceleratedStyle={animations.gpuAcceleratedStyle}
            handleMouseDown={handleMouseDown}
            handleResizerDoubleClick={handleResizerDoubleClick}
            isWebviewMounted={isWebviewMounted}
            isResizing={isResizing}
            isBarHovered={workspaceState.isBarHovered}
            onBarHoverChange={workspaceState.setIsBarHovered}
            leftPanelProps={combinedLeftPanelProps}
            bgMode={bgMode}
          />
        </div>

        <AnimatePresence>
          {focus.mode !== null && (
            <Suspense fallback={null}>
              <FocusOverlay
                key="focus-overlay"
                mode={focus.mode}
                onClose={focus.close}
                isWebviewMounted={isWebviewMounted}
                isResizing={false}
                isBarHovered={false}
              />
            </Suspense>
          )}
        </AnimatePresence>

        <Suspense fallback={null}>
          <GeminiWebLoginLayer />
        </Suspense>

        <Suspense fallback={null}>
          <PendingAiSendLayer />
        </Suspense>

        <Suspense fallback={null}>
          <ScreenshotToolLayer />
        </Suspense>

        <Suspense fallback={null}>
          <TutorialLayer isFocusActive={isFocusActive} />
        </Suspense>
      </div>
    </LayoutGroup>
  )
}

const GeminiWebLoginLayer = memo(function GeminiWebLoginLayer() {
  const { isGeminiWebLoginInProgress } = useAppToolGeminiSessionState()
  const { dismissGeminiWebLoginOverlay } = useAppToolActions()

  // We only show the full-screen overlay for the interactive login flow.
  // Silent background session refreshes run invisibly — the user does not
  // need to see an informational overlay for something that happens
  // automatically and does not require any action.
  const mode = useMemo<GeminiWebLoginOverlayMode>(() => {
    if (isGeminiWebLoginInProgress) return 'login'
    return 'hidden'
  }, [isGeminiWebLoginInProgress])

  const handleDismiss = useCallback(() => {
    dismissGeminiWebLoginOverlay()
  }, [dismissGeminiWebLoginOverlay])

  return <GeminiWebLoginOverlay mode={mode} onDismiss={handleDismiss} />
})

const PendingAiSendLayer = memo(function PendingAiSendLayer() {
  const { pendingAiItems } = useAppToolQueueState()
  const { clearPendingAiItems, sendPendingAiItems } = useAppToolActions()

  const handleSend = useCallback(
    ({
      noteText,
      autoSend,
      forceAutoSend
    }: {
      noteText?: string
      autoSend?: boolean
      forceAutoSend?: boolean
    }) => sendPendingAiItems({ promptText: noteText, autoSend, forceAutoSend }),
    [sendPendingAiItems]
  )

  if (!pendingAiItems || pendingAiItems.length === 0) {
    return null
  }

  return (
    <AiSendComposer items={pendingAiItems} onClearAll={clearPendingAiItems} onSend={handleSend} />
  )
})

const ScreenshotToolLayer = memo(function ScreenshotToolLayer() {
  const { isScreenshotMode } = useAppToolScreenshotState()
  const { handleCapture, closeScreenshot } = useAppToolActions()

  return (
    <ScreenshotTool
      isActive={isScreenshotMode}
      onCapture={handleCapture}
      onClose={closeScreenshot}
    />
  )
})

const TutorialLayer = memo(function TutorialLayer({ isFocusActive }: { isFocusActive: boolean }) {
  const activeTutorialId = useTutorialStore((s) => s.activeTutorialId)
  const closeTutorial = useTutorialStore((s) => s.closeTutorial)

  if (!activeTutorialId || isFocusActive) return null

  const entry = getTutorialEntry(activeTutorialId)
  if (!entry) return null

  const CustomComponent = entry.component
  if (CustomComponent) {
    return <CustomComponent tutorialId={activeTutorialId} isActive onClose={closeTutorial} />
  }

  return <TutorialOverlay tutorialId={activeTutorialId} isActive onClose={closeTutorial} />
})

export default memo(App)

import MainWorkspace from '@app/ui/MainWorkspace'
import { useAppearance } from '@shared/stores/appearanceStore'
import { useLanguage } from '@shared/stores/languageStore'
import ToastContainer from '@ui/components/Toast/ToastContainer'
import AppBackground from '@ui/layout/AppBackground'

import { AnimatePresence, LayoutGroup } from 'motion/react'
import type { RefObject } from 'react'
import { lazy, memo, Suspense, useCallback, useMemo } from 'react'

const FocusOverlay = lazy(() => import('@app/ui/FocusOverlay'))
const ScreenshotTool = lazy(() =>
  import('@features/screenshot/tool').then((m) => ({ default: m.ScreenshotTool }))
)
const TutorialOverlay = lazy(() =>
  import('@features/tutorial').then((m) => ({ default: m.TutorialOverlay }))
)
const UpdateBanner = lazy(() => import('@ui/components/UpdateBanner'))
const AiSendComposer = lazy(() => import('@app/ui/AiSendComposer'))
const LanguageSelectionDialog = lazy(() =>
  import('@features/onboarding').then((m) => ({
    default: m.LanguageSelectionDialog
  }))
)
import { useAiViewSurfaceState } from '@features/ai/viewState'
import { useShellOpenPdf } from '@features/pdf'
import { usePdfShortcuts } from '@features/pdf'
import { useTutorialStore } from '@features/tutorial'
import { getTutorialEntry } from '@features/tutorial'

import { useAppShellState } from '@app/hooks/useAppShellState'
import { useCacheThresholdWarning } from '@app/hooks/useCacheThresholdWarning'
import { usePdfWorkspaceState } from '@app/hooks/usePdfWorkspaceState'
import { useAppToolActions, useAppToolQueueState, useAppToolScreenshotState } from '@app/providers'
import { useAiTabsSliceState, useAiViewRequestNonce } from '@app/providers/ai-context'

function App() {
  // Önbellek boyutunu izler ve %80 eşiği aşıldığında kullanıcıya uyarı toast'ı gösterir.
  useCacheThresholdWarning()

  const {
    updateAvailable,
    updateInfo,
    isLayoutSwapped,
    animations,
    isAiSurfaceMounted,
    panelResize,
    workspaceState,
    updateBanner,
    focus
  } = useAppShellState()

  const bgMode = useAppearance((state) => state.bgMode)

  const {
    t,
    leftPanelProps,
    readingProps,
    rootDragHandlers,
    isInteractionBlocked,
    isPanelResizing
  } = usePdfWorkspaceState({
    isInteractionBlocked: workspaceState.isBarHovered || panelResize.isResizing,
    isPanelResizing: panelResize.isResizing
  })

  // Keep shortcut stable — readingProps changes shouldn't rebind the global handler.
  usePdfShortcuts({ onSelectPdf: leftPanelProps?.onSelectPdf })

  // Windows Explorer sağ-tık "QuizLab ile Aç" ile gelen PDF'leri karşıla.
  useShellOpenPdf()

  const combinedLeftPanelProps = useMemo(
    () => ({ ...(leftPanelProps ?? {}), ...(readingProps ?? {}) }),
    [leftPanelProps, readingProps]
  )
  const {
    leftPanelWidth,
    leftPanelRef,
    resizerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleLostPointerCapture,
    nudgeLeftPanelWidth,
    isResizing,
    setLeftPanelWidth
  } = panelResize
  const handleResizerDoubleClick = useCallback(() => {
    setLeftPanelWidth(50)
  }, [setLeftPanelWidth])

  const isFocusActive = focus.mode !== null
  const isOnboardingDone = useLanguage((s) => s.isOnboardingDone)

  // AI tab liveness lives here, above the workspace / focus-mode split, so a
  // focus switch repositions the managed views instead of rebuilding them.
  const { tabs: aiTabs, activeTabId: activeAiTabId } = useAiTabsSliceState()
  const aiViewRequestNonce = useAiViewRequestNonce()
  const aiViewSurfaceState = useAiViewSurfaceState({
    tabIds: aiTabs.map((tab) => tab.id),
    activeTabId: activeAiTabId,
    aiViewRequestNonce
  })
  const isAiFocusSurface = isFocusActive && focus.mode === 'ai'

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

        {!isFocusActive && (
          <div>
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
              handlePointerDown={handlePointerDown}
              handlePointerMove={handlePointerMove}
              handlePointerUp={handlePointerUp}
              handleLostPointerCapture={handleLostPointerCapture}
              handleResizerDoubleClick={handleResizerDoubleClick}
              onKeyboardResize={nudgeLeftPanelWidth}
              isResizeReversed={isLayoutSwapped}
              isAiSurfaceMounted={isAiSurfaceMounted}
              isResizing={isResizing}
              isBarHovered={workspaceState.isBarHovered}
              onBarHoverChange={workspaceState.setIsBarHovered}
              leftPanelProps={combinedLeftPanelProps}
              isInteractionBlocked={isInteractionBlocked}
              isPanelResizing={isPanelResizing}
              bgMode={bgMode}
              isAiSurfaceActive={!isAiFocusSurface}
              aiViewSurfaceState={aiViewSurfaceState}
            />
          </div>
        )}

        <AnimatePresence>
          {focus.mode !== null && (
            <Suspense fallback={null}>
              <FocusOverlay
                key="focus-overlay"
                mode={focus.mode}
                onClose={focus.close}
                isAiSurfaceMounted={isAiSurfaceMounted}
                isResizing={false}
                isBarHovered={false}
                isAiSurfaceActive={isAiFocusSurface}
                aiViewSurfaceState={aiViewSurfaceState}
              />
            </Suspense>
          )}
        </AnimatePresence>

        <Suspense fallback={null}>
          <PendingAiSendLayer />
        </Suspense>

        <Suspense fallback={null}>
          <ScreenshotToolLayer />
        </Suspense>

        <Suspense fallback={null}>
          <TutorialLayer isFocusActive={isFocusActive} />
        </Suspense>

        {!isOnboardingDone && (
          <Suspense fallback={null}>
            <LanguageSelectionDialog />
          </Suspense>
        )}
      </div>
    </LayoutGroup>
  )
}

const PendingAiSendLayer = memo(function PendingAiSendLayer() {
  const { pendingAiItems, autoSend } = useAppToolQueueState()
  const { clearPendingAiItems, sendPendingAiItems, toggleAutoSend } = useAppToolActions()

  const handleSend = useCallback(
    ({ noteText, autoSend }: { noteText?: string; autoSend?: boolean }) =>
      sendPendingAiItems({ promptText: noteText, autoSend }),
    [sendPendingAiItems]
  )

  if (!pendingAiItems || pendingAiItems.length === 0) {
    return null
  }

  return (
    <AiSendComposer
      items={pendingAiItems}
      onClearAll={clearPendingAiItems}
      onSend={handleSend}
      autoSend={autoSend}
      onToggleAutoSend={toggleAutoSend}
    />
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

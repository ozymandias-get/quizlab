import MainWorkspace from '@app/ui/MainWorkspace'
import { useAppearance } from '@shared/stores/appearanceStore'
import { useLanguage } from '@shared/stores/languageStore'
import ToastContainer from '@ui/components/Toast/ToastContainer'
import AppBackground from '@ui/layout/AppBackground'

import { AnimatePresence, LayoutGroup } from 'motion/react'
import type { RefObject } from 'react'
import { lazy, memo, Suspense, useCallback, useMemo, useRef } from 'react'

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
import { useShellOpenPdf } from '@features/pdf'
import { usePdfShortcuts } from '@features/pdf'
import { useCacheThresholdWarning } from '@features/settings'
import { useTutorialStore } from '@features/tutorial'
import { getTutorialEntry } from '@features/tutorial'

import { useAppShellState } from '@app/hooks/useAppShellState'
import { usePdfWorkspaceState } from '@app/hooks/usePdfWorkspaceState'
import { useAppToolActions, useAppToolQueueState, useAppToolScreenshotState } from '@app/providers'

function App() {
  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œnbellek boyutunu izle ve %80 eÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸iÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸i aÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±lÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±rsa uyarÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â± gÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶ster (oturum baÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±na bir kez)
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

  // Keep shortcut stable ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â readingProps changes shouldn't rebind the global handler.
  usePdfShortcuts({ onSelectPdf: leftPanelProps?.onSelectPdf })

  // Windows Explorer saÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸-tÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±k "QuizLab ile AÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§" ile gelen PDF'leri karÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±la.
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
  const aiTabUrlCacheRef = useRef<Record<string, { url: string; modelId: string }>>({})
  const isOnboardingDone = useLanguage((s) => s.isOnboardingDone)

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
              isWebviewMounted={isWebviewMounted}
              isResizing={isResizing}
              isBarHovered={workspaceState.isBarHovered}
              onBarHoverChange={workspaceState.setIsBarHovered}
              leftPanelProps={combinedLeftPanelProps}
              isInteractionBlocked={isInteractionBlocked}
              isPanelResizing={isPanelResizing}
              bgMode={bgMode}
              aiTabUrlCacheRef={aiTabUrlCacheRef}
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
                isWebviewMounted={isWebviewMounted}
                isResizing={false}
                isBarHovered={false}
                aiTabUrlCacheRef={aiTabUrlCacheRef}
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

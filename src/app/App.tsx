import ToastContainer from '@app/components/Toast/ToastContainer'
import MainWorkspace from '@app/ui/MainWorkspace'
import { useLanguage } from '@shared/stores/languageStore'

import { AnimatePresence, LayoutGroup } from 'motion/react'
import type { RefObject } from 'react'
import { lazy, memo, Suspense, useCallback, useMemo } from 'react'

const FocusOverlay = lazy(() => import('@app/ui/FocusOverlay'))
const ScreenshotTool = lazy(() =>
  import('@features/screenshot/tool').then((m) => ({ default: m.ScreenshotTool }))
)
const CaptureChoiceMenu = lazy(() => import('@app/ui/CaptureChoiceMenu'))
const UpdateBanner = lazy(() => import('@app/components/UpdateBanner'))
const AiSendComposer = lazy(() => import('@app/ui/AiSendComposer'))
const AiDraftLayer = lazy(() =>
  import('@app/ui/AiDraftLayer').then((m) => ({ default: m.AiDraftLayer }))
)
const LanguageSelectionDialog = lazy(() =>
  import('@features/onboarding').then((m) => ({
    default: m.LanguageSelectionDialog
  }))
)
import { useAiViewSurfaceState } from '@features/ai/viewState'
import { useDriveViewRetirement, useShellOpenPdf } from '@features/pdf'

import { useAppShellState } from '@app/hooks/useAppShellState'
import { useCacheThresholdWarning } from '@app/hooks/useCacheThresholdWarning'
import { usePdfWorkspaceState } from '@app/hooks/usePdfWorkspaceState'
import { useAppToolActions, useAppToolQueueState, useAppToolScreenshotState } from '@app/providers'
import { useAiTabsSliceState, useAiViewRequestNonce } from '@app/providers/ai-context'
import { resolveSendOutcome } from '@app/ui/aiSendComposer/sendOutcome'
import { useManagedViewRetirement } from '@shared/hooks/aiContent/managedViewLifecycle'

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
    updateBanner,
    focus
  } = useAppShellState()

  const {
    t,
    leftPanelProps,
    readingProps,
    rootDragHandlers,
    isInteractionBlocked,
    isPanelResizing
  } = usePdfWorkspaceState({
    isInteractionBlocked: panelResize.isResizing,
    isPanelResizing: panelResize.isResizing
  })

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
  const aiTabIds = useMemo(() => aiTabs.map((tab) => tab.id), [aiTabs])
  const aiViewSurfaceState = useAiViewSurfaceState({
    tabIds: aiTabIds,
    activeTabId: activeAiTabId,
    aiViewRequestNonce
  })
  // Lifecycle ownership, deliberately above the two AI surfaces. A tab that
  // leaves the `maxAliveTabs` alive set (LRU eviction, or a close) no longer has
  // a mounted `AiSession` to react to it, so its native view is retired here —
  // otherwise every evicted tab would keep a `WebContents` alive in main.
  useManagedViewRetirement(aiViewSurfaceState.aliveTabIds)
  // Same contract for the Google Drive panel, which is mounted twice (workspace
  // and focus overlay) under one view id.
  useDriveViewRetirement()
  const isAiFocusSurface = isFocusActive && focus.mode === 'ai'
  const shouldShowUpdateBanner =
    updateAvailable && Boolean(updateInfo) && updateBanner.isVisible && !isFocusActive

  return (
    <LayoutGroup>
      <div
        className="animate-app-enter relative h-screen w-screen overflow-hidden"
        {...rootDragHandlers}
      >
        <ToastContainer />

        {/* The workspace pads its top edge, but that gutter was not part of any
            drag region: only the tab strips were draggable. This invisible strip
            covers exactly that empty padding (h-3…h-6 matches py-3…py-6) so the
            window can be grabbed from the top edge without overlaying tabs. */}
        <div
          aria-hidden
          className="app-drag-gutter absolute inset-x-0 top-0 z-10 h-3 sm:h-4 md:h-5 lg:h-6"
        />

        {shouldShowUpdateBanner && (
          <Suspense fallback={null}>
            <UpdateBanner
              updateAvailable={updateAvailable}
              updateInfo={updateInfo}
              isVisible
              onClose={updateBanner.close}
              t={t}
            />
          </Suspense>
        )}

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
              handlePointerDown={handlePointerDown}
              handlePointerMove={handlePointerMove}
              handlePointerUp={handlePointerUp}
              handleLostPointerCapture={handleLostPointerCapture}
              handleResizerDoubleClick={handleResizerDoubleClick}
              onKeyboardResize={nudgeLeftPanelWidth}
              isResizeReversed={isLayoutSwapped}
              isAiSurfaceMounted={isAiSurfaceMounted}
              isResizing={isResizing}
              leftPanelProps={combinedLeftPanelProps}
              isInteractionBlocked={isInteractionBlocked}
              isPanelResizing={isPanelResizing}
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
          <CaptureChoiceMenu />
        </Suspense>

        <ScreenshotToolLayer />

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
  const { pendingAiItems, autoSend, unsafeSendIdsRef } = useAppToolQueueState()
  const {
    clearPendingAiItems,
    removePendingAiItem,
    sendPendingAiItems,
    toggleAutoSend,
    markUnsafeSendIds
  } = useAppToolActions()

  const handleSend = useCallback(
    async ({ noteText, autoSend }: { noteText?: string; autoSend?: boolean }) => {
      // Gönderime giren kimlikler, sonuç gelmeden **önce** sabitlenir. Sonuç
      // kısmi/belirsizse bu kimlikler kuyruğun güvenlik kaydına yazılır.
      // Kayıt composer'da değil burada tutulduğu için panel unmount olsa bile
      // "geri al" ile dönen içerik yeniden gönderilebilir hâle gelmez.
      const sentIds = pendingAiItems.map((item) => item.id)
      try {
        const result = await sendPendingAiItems({ promptText: noteText, autoSend })
        if (resolveSendOutcome(result).kind === 'incomplete') markUnsafeSendIds(sentIds)
        return result
      } catch (error) {
        // İstisna, hedefe dokunulmadığının kanıtı değildir: composer da aynı
        // sonucu "incomplete" sayar, kayıt burada da güvenli tarafta kalır.
        markUnsafeSendIds(sentIds)
        throw error
      }
    },
    [markUnsafeSendIds, pendingAiItems, sendPendingAiItems]
  )

  // PDF panelindeki yuvaya portal ile yerleşir (bkz. AiDraftLayer).
  // PDF açık değilken ve taslak boşken hiç render edilmez — PDF ekleme
  // ekranında yüzen bir kontrol anlamsız. Taslak doluysa erişim korunur.
  return (
    <AiDraftLayer hasContent={(pendingAiItems?.length ?? 0) > 0}>
      {(placement) => (
        <AiSendComposer
          items={pendingAiItems ?? []}
          onClearAll={clearPendingAiItems}
          onRemoveItem={removePendingAiItem}
          onSend={handleSend}
          autoSend={autoSend}
          onToggleAutoSend={toggleAutoSend}
          placement={placement}
          unsafeSendIdsRef={unsafeSendIdsRef}
        />
      )}
    </AiDraftLayer>
  )
})

const ScreenshotToolLayer = memo(function ScreenshotToolLayer() {
  const { isScreenshotMode } = useAppToolScreenshotState()
  const { handleCapture, closeScreenshot } = useAppToolActions()

  if (!isScreenshotMode) return null

  return (
    <Suspense fallback={null}>
      <ScreenshotTool
        isActive={isScreenshotMode}
        onCapture={handleCapture}
        onClose={closeScreenshot}
      />
    </Suspense>
  )
})

export default memo(App)

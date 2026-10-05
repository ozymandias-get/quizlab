import type { AiSendOptions } from '@features/ai'

import { useToastActions } from '@shared/stores/toastStore'

import { createContext, type ReactNode, useContext, useMemo } from 'react'

import type { AiDraftItem, AiSendResult, SelectionPosition } from './ai/types'
import {
  useAiContent,
  useAiMessagingActions,
  useAiSessionActions,
  useAiSessionUiPrefsState
} from './ai-context'
import { type QueuedImageMeta, useAiDraftQueue } from './app-tool/useAiDraftQueue'
import { useDraftSendOrchestration } from './app-tool/useDraftSendOrchestration'
import { useElementPickerLifecycle } from './app-tool/useElementPickerLifecycle'
import { useGeminiSessionRefreshListeners } from './app-tool/useGeminiSessionRefreshListeners'
import { useScreenshotPipeline } from './app-tool/useScreenshotPipeline'

export interface AppToolQueueState {
  pendingAiItems: AiDraftItem[]
  autoSend: boolean
}

interface AppToolScreenshotState {
  isScreenshotMode: boolean
}

interface AppToolPickerState {
  isPickerActive: boolean
}

interface AppToolActionsType {
  startScreenshot: (imageMeta?: QueuedImageMeta) => void
  closeScreenshot: () => void
  handleCapture: (dataUrl: string) => Promise<void>
  queueTextForAi: (text: string, position?: SelectionPosition | null) => void
  queueImageForAi: (dataUrl: string, imageMeta?: QueuedImageMeta) => void
  removePendingAiItem: (id: string) => void
  clearPendingAiItems: () => void
  sendPendingAiItems: (options?: AiSendOptions) => Promise<AiSendResult>
  setAutoSend: (value: boolean) => void
  toggleAutoSend: () => void
  startPicker: () => void
  startPickerWhenReady: () => void
  togglePicker: () => void
}

/**
 * One context per concern, so a consumer only re-renders for the slice it reads.
 * There is deliberately no combined "give me everything" hook: it produced a new
 * object on every flag change, which re-rendered consumers for state they never
 * used. Compose the hooks you need instead.
 */
const AppToolQueueContext = createContext<AppToolQueueState | null>(null)
const AppToolScreenshotContext = createContext<AppToolScreenshotState | null>(null)
const AppToolPickerContext = createContext<AppToolPickerState | null>(null)
const AppToolActionsContext = createContext<AppToolActionsType | null>(null)

function AppToolProvider({ children }: { children: ReactNode }) {
  const { sendTextToAI, sendImageToAI, cancelOngoing } = useAiMessagingActions()
  const { setAutoSend, toggleAutoSend } = useAiSessionActions()
  const { autoSend } = useAiSessionUiPrefsState()
  const { showError } = useToastActions()
  const { getContentController } = useAiContent()

  const {
    pendingAiItems,
    pendingAiItemsRef,
    setPendingAiItems,
    queueTextForAi,
    queueImageForAi,
    removePendingAiItem,
    clearPendingAiItems: clearPendingAiItemsRaw
  } = useAiDraftQueue(() => showError('draft_queue_full'))

  const { isScreenshotMode, startScreenshot, closeScreenshot, handleCapture, clearScreenshotMeta } =
    useScreenshotPipeline({ queueImageForAi })

  const clearPendingAiItems = useMemo(() => {
    return () => {
      cancelOngoing()
      clearScreenshotMeta()
      clearPendingAiItemsRaw()
    }
  }, [cancelOngoing, clearScreenshotMeta, clearPendingAiItemsRaw])

  const { sendPendingAiItems } = useDraftSendOrchestration({
    autoSend,
    sendTextToAI,
    sendImageToAI,
    pendingAiItemsRef,
    setPendingAiItems
  })

  const { isPickerActive, startPicker, startPickerWhenReady, togglePicker } =
    useElementPickerLifecycle(getContentController)

  useGeminiSessionRefreshListeners({ showError })

  const queueValue = useMemo<AppToolQueueState>(
    () => ({ pendingAiItems, autoSend }),
    [pendingAiItems, autoSend]
  )

  const screenshotValue = useMemo<AppToolScreenshotState>(
    () => ({ isScreenshotMode }),
    [isScreenshotMode]
  )

  const pickerValue = useMemo<AppToolPickerState>(() => ({ isPickerActive }), [isPickerActive])

  const actionsValue = useMemo<AppToolActionsType>(
    () => ({
      startScreenshot,
      closeScreenshot,
      handleCapture,
      queueTextForAi,
      queueImageForAi,
      removePendingAiItem,
      clearPendingAiItems,
      sendPendingAiItems,
      setAutoSend,
      toggleAutoSend,
      startPicker,
      startPickerWhenReady,
      togglePicker
    }),
    [
      startScreenshot,
      closeScreenshot,
      handleCapture,
      queueTextForAi,
      queueImageForAi,
      removePendingAiItem,
      clearPendingAiItems,
      sendPendingAiItems,
      setAutoSend,
      toggleAutoSend,
      startPicker,
      startPickerWhenReady,
      togglePicker
    ]
  )

  return (
    <AppToolQueueContext.Provider value={queueValue}>
      <AppToolScreenshotContext.Provider value={screenshotValue}>
        <AppToolPickerContext.Provider value={pickerValue}>
          <AppToolActionsContext.Provider value={actionsValue}>
            {children}
          </AppToolActionsContext.Provider>
        </AppToolPickerContext.Provider>
      </AppToolScreenshotContext.Provider>
    </AppToolQueueContext.Provider>
  )
}

export default AppToolProvider

export const useAppToolQueueState = () => {
  const context = useContext(AppToolQueueContext)
  if (!context) throw new Error('useAppToolQueueState must be used within AppToolProvider')
  return context
}

export const useAppToolScreenshotState = () => {
  const context = useContext(AppToolScreenshotContext)
  if (!context) throw new Error('useAppToolScreenshotState must be used within AppToolProvider')
  return context
}

export const useAppToolPickerState = () => {
  const context = useContext(AppToolPickerContext)
  if (!context) throw new Error('useAppToolPickerState must be used within AppToolProvider')
  return context
}

export const useAppToolActions = () => {
  const context = useContext(AppToolActionsContext)
  if (!context) throw new Error('useAppToolActions must be used within AppToolProvider')
  return context
}

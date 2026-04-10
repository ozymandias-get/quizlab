import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { AiSendOptions } from '@features/ai'
import {
  useAiCoreWorkspaceActions,
  useAiMessagingActions,
  useAiSessionUiPrefsState,
  useAiWebview
} from './AiContext'
import type { GeminiWebSessionActionResult } from '@shared-core/types'
import type { AiDraftItem, AiSendResult } from './ai/types'
import { useToastActions } from './ToastContext'

import { useAiDraftQueue, type QueuedImageMeta } from './app-tool/useAiDraftQueue'
import { useScreenshotPipeline } from './app-tool/useScreenshotPipeline'
import { useElementPickerLifecycle } from './app-tool/useElementPickerLifecycle'
import { useDraftSendOrchestration } from './app-tool/useDraftSendOrchestration'
import { useGeminiSessionRefreshListeners } from './app-tool/useGeminiSessionRefreshListeners'

export interface AppToolQueueState {
  pendingAiItems: AiDraftItem[]
  autoSend: boolean
}

export interface AppToolFlagsState {
  isScreenshotMode: boolean
  isPickerActive: boolean
  isGeminiWebLoginInProgress: boolean
  isGeminiWebSessionRefreshing: boolean
}

export type AppToolStateType = AppToolQueueState & AppToolFlagsState

interface AppToolActionsType {
  startScreenshot: (imageMeta?: QueuedImageMeta) => void
  closeScreenshot: () => void
  handleCapture: (dataUrl: string) => Promise<void>
  queueTextForAi: (text: string) => void
  queueImageForAi: (dataUrl: string, imageMeta?: QueuedImageMeta) => void
  removePendingAiItem: (id: string) => void
  clearPendingAiItems: () => void
  sendPendingAiItems: (options?: AiSendOptions) => Promise<AiSendResult>
  setAutoSend: (value: boolean) => void
  startPicker: () => void
  startPickerWhenReady: () => void
  togglePicker: () => void
  startGeminiWebLogin: () => Promise<GeminiWebSessionActionResult>
}

const AppToolQueueContext = createContext<AppToolQueueState | null>(null)
const AppToolFlagsContext = createContext<AppToolFlagsState | null>(null)
const AppToolActionsContext = createContext<AppToolActionsType | null>(null)

export function AppToolProvider({ children }: { children: ReactNode }) {
  const { sendTextToAI, sendImageToAI } = useAiMessagingActions()
  const { setAutoSend } = useAiCoreWorkspaceActions()
  const { autoSend } = useAiSessionUiPrefsState()
  const { showError } = useToastActions()
  const { webviewInstance } = useAiWebview()

  const {
    pendingAiItems,
    pendingAiItemsRef,
    setPendingAiItems,
    queueTextForAi,
    queueImageForAi,
    removePendingAiItem,
    clearPendingAiItems: clearPendingAiItemsRaw
  } = useAiDraftQueue()

  const { isScreenshotMode, startScreenshot, closeScreenshot, handleCapture, clearScreenshotMeta } =
    useScreenshotPipeline({ queueImageForAi, clearPendingAiItemsExtras: undefined })

  const clearPendingAiItems = useMemo(() => {
    return () => {
      clearScreenshotMeta()
      clearPendingAiItemsRaw()
    }
  }, [clearScreenshotMeta, clearPendingAiItemsRaw])

  const { sendPendingAiItems } = useDraftSendOrchestration({
    autoSend,
    sendTextToAI,
    sendImageToAI,
    pendingAiItemsRef,
    setPendingAiItems
  })

  const { isPickerActive, startPicker, startPickerWhenReady, togglePicker } =
    useElementPickerLifecycle(webviewInstance)

  const { isGeminiWebSessionRefreshing, isGeminiWebLoginInProgress, startGeminiWebLogin } =
    useGeminiSessionRefreshListeners({ showError })

  const queueState = useMemo<AppToolQueueState>(
    () => ({ pendingAiItems, autoSend }),
    [pendingAiItems, autoSend]
  )

  const flagsState = useMemo<AppToolFlagsState>(
    () => ({
      isScreenshotMode,
      isPickerActive,
      isGeminiWebLoginInProgress,
      isGeminiWebSessionRefreshing
    }),
    [isScreenshotMode, isPickerActive, isGeminiWebLoginInProgress, isGeminiWebSessionRefreshing]
  )

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
      startPicker,
      startPickerWhenReady,
      togglePicker,
      startGeminiWebLogin
    }),
    [
      clearPendingAiItems,
      closeScreenshot,
      handleCapture,
      queueImageForAi,
      queueTextForAi,
      removePendingAiItem,
      sendPendingAiItems,
      setAutoSend,
      startGeminiWebLogin,
      startPicker,
      startPickerWhenReady,
      startScreenshot,
      togglePicker
    ]
  )

  return (
    <AppToolQueueContext.Provider value={queueState}>
      <AppToolFlagsContext.Provider value={flagsState}>
        <AppToolActionsContext.Provider value={actionsValue}>
          {children}
        </AppToolActionsContext.Provider>
      </AppToolFlagsContext.Provider>
    </AppToolQueueContext.Provider>
  )
}

export const useAppToolQueueState = () => {
  const context = useContext(AppToolQueueContext)
  if (!context) throw new Error('useAppToolQueueState must be used within AppToolProvider')
  return context
}

export const useAppToolFlagsState = () => {
  const context = useContext(AppToolFlagsContext)
  if (!context) throw new Error('useAppToolFlagsState must be used within AppToolProvider')
  return context
}

export const useAppToolActions = () => {
  const context = useContext(AppToolActionsContext)
  if (!context) throw new Error('useAppToolActions must be used within AppToolProvider')
  return context
}

export const useAppTools = () => {
  const queue = useAppToolQueueState()
  const flags = useAppToolFlagsState()
  const actions = useAppToolActions()

  return useMemo(
    () => ({
      ...queue,
      ...flags,
      ...actions
    }),
    [queue, flags, actions]
  )
}

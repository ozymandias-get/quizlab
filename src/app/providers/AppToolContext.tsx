import type { GeminiWebSessionActionResult } from '@shared-core/types'

import type { AiSendOptions } from '@features/ai/model/types'

import { useToastActions } from '@shared/stores/toastStore'

import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { AiDraftItem, AiSendResult } from './ai/types'
import {
  useAiMessagingActions,
  useAiSessionActions,
  useAiSessionUiPrefsState,
  useAiWebview
} from './AiContext'
import { type QueuedImageMeta, useAiDraftQueue } from './app-tool/useAiDraftQueue'
import { useDraftSendOrchestration } from './app-tool/useDraftSendOrchestration'
import { useElementPickerLifecycle } from './app-tool/useElementPickerLifecycle'
import { useGeminiSessionRefreshListeners } from './app-tool/useGeminiSessionRefreshListeners'
import { useScreenshotPipeline } from './app-tool/useScreenshotPipeline'

export interface AppToolQueueState {
  pendingAiItems: AiDraftItem[]
  autoSend: boolean
}

export interface AppToolFlagsState {
  isScreenshotMode: boolean
  isPickerActive: boolean
  isGeminiWebLoginInProgress: boolean
  isGeminiWebSessionRefreshing: boolean
  isGeminiWebLoginDismissed: boolean
}

type AppToolScreenshotState = Pick<AppToolFlagsState, 'isScreenshotMode'>
type AppToolPickerState = Pick<AppToolFlagsState, 'isPickerActive'>
type AppToolGeminiSessionState = Pick<
  AppToolFlagsState,
  'isGeminiWebLoginInProgress' | 'isGeminiWebSessionRefreshing' | 'isGeminiWebLoginDismissed'
>

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
  dismissGeminiWebLoginOverlay: () => void
}

const AppToolQueueContext = createContext<AppToolQueueState | null>(null)
const AppToolFlagsContext = createContext<AppToolFlagsState | null>(null)
const AppToolScreenshotContext = createContext<AppToolScreenshotState | null>(null)
const AppToolPickerContext = createContext<AppToolPickerState | null>(null)
const AppToolGeminiSessionContext = createContext<AppToolGeminiSessionState | null>(null)
const AppToolActionsContext = createContext<AppToolActionsType | null>(null)

export function AppToolProvider({ children }: { children: ReactNode }) {
  const { sendTextToAI, sendImageToAI, cancelOngoing } = useAiMessagingActions()
  const { setAutoSend } = useAiSessionActions()
  const { autoSend } = useAiSessionUiPrefsState()
  const { showError, showWarning } = useToastActions()
  const { t } = useTranslation()
  const { getWebviewInstance } = useAiWebview()

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
    useElementPickerLifecycle(getWebviewInstance)

  const {
    isGeminiWebSessionRefreshing,
    isGeminiWebLoginInProgress,
    isGeminiWebLoginDismissed,
    startGeminiWebLogin,
    dismissLoginOverlay
  } = useGeminiSessionRefreshListeners({ showError, showWarning, t })

  const queueValue = useMemo<AppToolQueueState>(
    () => ({ pendingAiItems, autoSend }),
    [pendingAiItems, autoSend]
  )

  const flagsValue = useMemo<AppToolFlagsState>(
    () => ({
      isScreenshotMode,
      isPickerActive,
      isGeminiWebLoginInProgress,
      isGeminiWebSessionRefreshing,
      isGeminiWebLoginDismissed
    }),
    [
      isScreenshotMode,
      isPickerActive,
      isGeminiWebLoginInProgress,
      isGeminiWebSessionRefreshing,
      isGeminiWebLoginDismissed
    ]
  )

  const screenshotValue = useMemo<AppToolScreenshotState>(
    () => ({ isScreenshotMode }),
    [isScreenshotMode]
  )

  const pickerValue = useMemo<AppToolPickerState>(() => ({ isPickerActive }), [isPickerActive])

  const geminiSessionValue = useMemo<AppToolGeminiSessionState>(
    () => ({
      isGeminiWebLoginInProgress,
      isGeminiWebSessionRefreshing,
      isGeminiWebLoginDismissed
    }),
    [isGeminiWebLoginInProgress, isGeminiWebSessionRefreshing, isGeminiWebLoginDismissed]
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
      startGeminiWebLogin,
      dismissGeminiWebLoginOverlay: dismissLoginOverlay
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
      startPicker,
      startPickerWhenReady,
      togglePicker,
      startGeminiWebLogin,
      dismissLoginOverlay
    ]
  )

  return (
    <AppToolQueueContext.Provider value={queueValue}>
      <AppToolFlagsContext.Provider value={flagsValue}>
        <AppToolScreenshotContext.Provider value={screenshotValue}>
          <AppToolPickerContext.Provider value={pickerValue}>
            <AppToolGeminiSessionContext.Provider value={geminiSessionValue}>
              <AppToolActionsContext.Provider value={actionsValue}>
                {children}
              </AppToolActionsContext.Provider>
            </AppToolGeminiSessionContext.Provider>
          </AppToolPickerContext.Provider>
        </AppToolScreenshotContext.Provider>
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

export const useAppToolGeminiSessionState = () => {
  const context = useContext(AppToolGeminiSessionContext)
  if (!context) throw new Error('useAppToolGeminiSessionState must be used within AppToolProvider')
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

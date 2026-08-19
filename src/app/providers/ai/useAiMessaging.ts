import type { AiPlatform } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

import { useAiSender } from '@features/ai/hooks/useAiSender'
import { resolveAutoSend } from '@features/ai/lib/sendUtils'
import type { AiSendOptions } from '@features/ai/model/types'

import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useEffect, useMemo, useRef } from 'react'

import type * as ChatUiStoreModule from '../../../features/ai/store/chatUiStore'
import { toErrorToastKey } from './errorToastKey'
import { scheduleApiChatSend, waitForApiChatTab } from './lib/apiChatSend'
import { waitForWebviewReadyForSend } from './webviewSendReadiness'

let chatUiStoreModule: typeof ChatUiStoreModule | null = null

async function getChatUiStore() {
  if (!chatUiStoreModule) {
    chatUiStoreModule = await import('../../../features/ai/store/chatUiStore')
  }
  return chatUiStoreModule.useChatUiStore
}

interface UseAiMessagingParams {
  getWebviewInstance: (tabId?: string) => WebviewController | null
  currentAI: string
  activeTabId: string
  autoSend: boolean
  aiRegistry: Record<string, AiPlatform>
  showSuccess: (message: string, title?: string) => void
  showWarning: (message: string, title?: string) => void
  openAiWorkspace: (modelId: string) => void
}

export function useAiMessaging({
  getWebviewInstance,
  currentAI,
  activeTabId,
  autoSend,
  aiRegistry,
  showSuccess,
  showWarning,
  openAiWorkspace
}: UseAiMessagingParams) {
  const apiChatSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId

  useEffect(() => {
    const timeout = apiChatSendTimeoutRef.current
    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [])

  const webviewRefProxy = useMemo(
    () => ({
      get current() {
        return getWebviewInstance()
      }
    }),
    [getWebviewInstance]
  )
  const {
    sendTextToAI: rawSendText,
    sendImageToAI: rawSendImage,
    cancelOngoing
  } = useAiSender(webviewRefProxy, currentAI, autoSend, aiRegistry, activeTabId)

  const waitForWebviewReady = useCallback(
    (timeoutMs = 10_000) => waitForWebviewReadyForSend(getWebviewInstance, timeoutMs),
    [getWebviewInstance]
  )

  const ensureApiChatTab = useCallback(async () => {
    if (activeTabIdRef.current) return activeTabIdRef.current
    openAiWorkspace('api-chat')
    return waitForApiChatTab(() => activeTabIdRef.current)
  }, [openAiWorkspace])

  const handleApiChatSendResult = useCallback(
    (result: { success: boolean; error?: string }) => {
      if (!result.success && result.error && result.error !== 'empty_message') {
        reportSuppressedError('useAiMessaging.apiChatSend', {
          cause: new Error(result.error)
        })
        showWarning(toErrorToastKey(result.error))
      }
    },
    [showWarning]
  )

  const sendTextToAI = useCallback(
    async (text: string, options?: AiSendOptions) => {
      if (currentAI === 'api-chat') {
        // api-chat uses a store-based tab, not a webview. If no tab exists,
        // auto-open one for api-chat and wait for it to become active.
        const currentTabId = await ensureApiChatTab()
        if (!currentTabId) {
          return { success: false, error: 'webview_not_ready' }
        }
        try {
          const UiStore = await getChatUiStore()
          const uiState = UiStore.getState()
          const val = uiState.inputValueByTab[currentTabId] || ''
          const newVal = val ? val + '\n' + text : text
          uiState.updateInput(currentTabId, newVal)
          const effectiveAutoSend = resolveAutoSend(autoSend, options)
          if (effectiveAutoSend) {
            const result = await scheduleApiChatSend(currentTabId, apiChatSendTimeoutRef)
            handleApiChatSendResult(result)
            return result
          }
          return { success: true }
        } catch (err) {
          return { success: false, error: ensureErrorMessage(err, 'send_failed') }
        }
      }

      // For webview-based models, ensure a webview instance is available.
      // In normal split view, the user may not have an AI tab open yet.
      const webview = getWebviewInstance()
      if (!webview) {
        openAiWorkspace(currentAI)
      }
      const isReady = await waitForWebviewReady()
      if (!isReady) {
        reportSuppressedError('useAiMessaging.waitForWebview', {
          cause: new Error('Webview did not become ready in time')
        })
        showWarning('error_webview_not_ready')
        return { success: false, error: 'webview_not_ready' }
      }

      const result = (await rawSendText(text, options)) ?? { success: false, error: 'cancelled' }
      if (!result.success && result.error !== 'cancelled') {
        showWarning(toErrorToastKey(result.error))
      }
      return result
    },
    [
      currentAI,
      autoSend,
      ensureApiChatTab,
      getWebviewInstance,
      handleApiChatSendResult,
      openAiWorkspace,
      rawSendText,
      showWarning,
      waitForWebviewReady
    ]
  )

  const sendImageToAI = useCallback(
    async (imageData: string, options?: AiSendOptions) => {
      if (currentAI === 'api-chat') {
        // Auto-open an api-chat tab if none exists and wait for it.
        const currentTabId = await ensureApiChatTab()
        if (!currentTabId) {
          return { success: false, error: 'webview_not_ready' }
        }
        try {
          const UiStore = await getChatUiStore()
          const uiState = UiStore.getState()
          uiState.addAttachment(currentTabId, imageData)
          if (options?.promptText) {
            const val = uiState.inputValueByTab[currentTabId] || ''
            uiState.updateInput(
              currentTabId,
              val ? val + '\n' + options.promptText : options.promptText
            )
          }
          const effectiveAutoSend = resolveAutoSend(autoSend, options)
          if (effectiveAutoSend) {
            const result = await scheduleApiChatSend(currentTabId, apiChatSendTimeoutRef)
            handleApiChatSendResult(result)
            if (result.success) showSuccess('sent_successfully')
            return result
          }
          return { success: true }
        } catch (err) {
          return { success: false, error: ensureErrorMessage(err, 'send_failed') }
        }
      }

      // For webview-based models, ensure a webview instance is available
      const webview = getWebviewInstance()
      if (!webview) {
        openAiWorkspace(currentAI)
      }
      const isReady = await waitForWebviewReady()
      if (!isReady) {
        reportSuppressedError('useAiMessaging.waitForWebview', {
          cause: new Error('Webview did not become ready in time for image send')
        })
        showWarning('error_webview_not_ready')
        return { success: false, error: 'webview_not_ready' }
      }

      const result = (await rawSendImage(imageData, options)) ?? {
        success: false,
        error: 'cancelled'
      }
      if (result.success) showSuccess('sent_successfully')
      else if (result.error !== 'cancelled') showWarning(toErrorToastKey(result.error))
      return result
    },
    [
      currentAI,
      autoSend,
      ensureApiChatTab,
      getWebviewInstance,
      handleApiChatSendResult,
      openAiWorkspace,
      rawSendImage,
      showSuccess,
      showWarning,
      waitForWebviewReady
    ]
  )

  return {
    sendTextToAI,
    sendImageToAI,
    cancelOngoing
  }
}

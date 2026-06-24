import type { AiPlatform } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

import { useAiSender } from '@features/ai/hooks/useAiSender'
import { resolveAutoSend } from '@features/ai/lib/sendUtils'
import type { AiSendOptions } from '@features/ai/model/types'

import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useMemo, useRef } from 'react'

import type * as ChatUiStoreModule from '../../../features/ai/store/chatUiStore'
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

function toErrorToastKey(errorKey: string | undefined): string {
  if (!errorKey) return 'error_unknown_error'
  const slug = errorKey
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, '_')
    .replaceAll(/[^\d_a-z]/g, '')
    .replaceAll(/_+/g, '_')
  if (!slug) return 'error_unknown_error'
  return `error_${slug}`
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

  const sendTextToAI = useCallback(
    async (text: string, options?: AiSendOptions) => {
      if (currentAI === 'api-chat') {
        // api-chat uses a store-based tab, not a webview. If no tab exists,
        // auto-open one for api-chat.
        if (!activeTabId) {
          openAiWorkspace('api-chat')
          // Wait a bit for the tab to be created and activeTabId to update
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (!activeTabIdRef.current) {
            return { success: false, error: 'webview_not_ready' }
          }
        }
        try {
          const UiStore = await getChatUiStore()
          const uiState = UiStore.getState()
          const currentTabId = activeTabIdRef.current
          const val = uiState.inputValueByTab[currentTabId] || ''
          const newVal = val ? val + '\n' + text : text
          uiState.updateInput(currentTabId, newVal)
          const effectiveAutoSend = resolveAutoSend(autoSend, options)
          if (effectiveAutoSend) {
            if (apiChatSendTimeoutRef.current) clearTimeout(apiChatSendTimeoutRef.current)
            apiChatSendTimeoutRef.current = setTimeout(async () => {
              apiChatSendTimeoutRef.current = null
              const uist = UiStore.getState()
              const sendTabId = activeTabIdRef.current
              // Use TanStack Query mutation for sending
              const { useSendMessageMutation: getMutation } =
                await import('@features/ai/queries/useSendMessageMutation')
              getMutation()
                .mutateAsync({
                  tabId: sendTabId,
                  text: uist.inputValueByTab[sendTabId] || '',
                  images: uist.attachmentsByTab[sendTabId] || [],
                  model: uist.selectedModelByTab[sendTabId],
                  providerId: uist.activeProviderByTab[sendTabId],
                  generalPrompt: uist.generalPrompt,
                  memoryPrompt: uist.memoryPrompt,
                  characterPrompt: uist.characterPrompt
                })
                .catch(() => {})
            }, 50)
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

      const result = await rawSendText(text, options)
      if (!result.success) showWarning(toErrorToastKey(result.error))
      return result
    },
    [
      currentAI,
      activeTabId,
      autoSend,
      getWebviewInstance,
      openAiWorkspace,
      rawSendText,
      showWarning,
      waitForWebviewReady
    ]
  )

  const sendImageToAI = useCallback(
    async (imageData: string, options?: AiSendOptions) => {
      if (currentAI === 'api-chat') {
        // Auto-open an api-chat tab if none exists
        if (!activeTabId) {
          openAiWorkspace('api-chat')
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (!activeTabIdRef.current) {
            return { success: false, error: 'webview_not_ready' }
          }
        }
        try {
          const UiStore = await getChatUiStore()
          const uiState = UiStore.getState()
          const currentTabId = activeTabIdRef.current
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
            if (apiChatSendTimeoutRef.current) clearTimeout(apiChatSendTimeoutRef.current)
            apiChatSendTimeoutRef.current = setTimeout(async () => {
              apiChatSendTimeoutRef.current = null
              const uist = UiStore.getState()
              const sendTabId = activeTabIdRef.current
              const { useSendMessageMutation: getMutation } =
                await import('@features/ai/queries/useSendMessageMutation')
              getMutation()
                .mutateAsync({
                  tabId: sendTabId,
                  text: uist.inputValueByTab[sendTabId] || '',
                  images: uist.attachmentsByTab[sendTabId] || [],
                  model: uist.selectedModelByTab[sendTabId],
                  providerId: uist.activeProviderByTab[sendTabId],
                  generalPrompt: uist.generalPrompt,
                  memoryPrompt: uist.memoryPrompt,
                  characterPrompt: uist.characterPrompt
                })
                .catch(() => {})
            }, 50)
          }
          showSuccess('sent_successfully')
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

      const result = await rawSendImage(imageData, options)
      if (result.success) showSuccess('sent_successfully')
      else showWarning(toErrorToastKey(result.error))
      return result
    },
    [
      currentAI,
      activeTabId,
      autoSend,
      getWebviewInstance,
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

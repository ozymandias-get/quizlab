import { useCallback, useMemo, useRef } from 'react'
import { useAiSender, useApiChatStore, type AiSendOptions } from '@features/ai'
import type { AiPlatform } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

interface UseAiMessagingParams {
  getWebviewInstance: (tabId?: string) => WebviewController | null
  currentAI: string
  activeTabId: string
  autoSend: boolean
  aiRegistry: Record<string, AiPlatform>
  showSuccess: (message: string, title?: string) => void
  showWarning: (message: string, title?: string) => void
}

/** Builds a valid i18n key from send pipeline error codes (avoids spaces / odd chars). */
function toErrorToastKey(errorKey: string | undefined): string {
  if (!errorKey) return 'error_unknown_error'
  const slug = errorKey
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
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
  showWarning
}: UseAiMessagingParams) {
  const apiChatSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const webviewRefProxy = useMemo(
    () => ({
      get current() {
        return getWebviewInstance()
      }
    }),
    [getWebviewInstance]
  )
  const { sendTextToAI: rawSendText, sendImageToAI: rawSendImage } = useAiSender(
    webviewRefProxy,
    currentAI,
    autoSend,
    aiRegistry,
    activeTabId
  )

  const sendTextToAI = useCallback(
    async (text: string, options?: AiSendOptions) => {
      if (currentAI === 'api-chat') {
        if (!activeTabId) return { success: false, error: 'webview_not_ready' }
        try {
          const store = useApiChatStore.getState()
          const val = store.inputValueByTab[activeTabId] || ''
          const newVal = val ? val + '\n' + text : text
          store.updateInput(activeTabId, newVal)
          const effectiveAutoSend =
            options?.forceAutoSend === true ? true : (options?.autoSend ?? autoSend)
          if (effectiveAutoSend) {
            if (apiChatSendTimeoutRef.current) clearTimeout(apiChatSendTimeoutRef.current)
            apiChatSendTimeoutRef.current = setTimeout(() => {
              apiChatSendTimeoutRef.current = null
              const st = useApiChatStore.getState()
              st.sendMessage(activeTabId, undefined, undefined, st.activeProviderByTab[activeTabId])
            }, 50)
          }
          return { success: true }
        } catch (err: any) {
          return { success: false, error: err.message || 'send_failed' }
        }
      }
      const result = await rawSendText(text, options)
      if (!result.success) showWarning(toErrorToastKey(result.error))
      return result
    },
    [currentAI, activeTabId, autoSend, rawSendText, showWarning]
  )

  const sendImageToAI = useCallback(
    async (imageData: string, options?: AiSendOptions) => {
      if (currentAI === 'api-chat') {
        if (!activeTabId) return { success: false, error: 'webview_not_ready' }
        try {
          const store = useApiChatStore.getState()
          store.addAttachment(activeTabId, imageData)
          if (options?.promptText) {
            const val = store.inputValueByTab[activeTabId] || ''
            store.updateInput(
              activeTabId,
              val ? val + '\n' + options.promptText : options.promptText
            )
          }
          const effectiveAutoSend =
            options?.forceAutoSend === true ? true : (options?.autoSend ?? autoSend)
          if (effectiveAutoSend) {
            if (apiChatSendTimeoutRef.current) clearTimeout(apiChatSendTimeoutRef.current)
            apiChatSendTimeoutRef.current = setTimeout(() => {
              apiChatSendTimeoutRef.current = null
              const st = useApiChatStore.getState()
              st.sendMessage(activeTabId, undefined, undefined, st.activeProviderByTab[activeTabId])
            }, 50)
          }
          showSuccess('sent_successfully')
          return { success: true }
        } catch (err: any) {
          return { success: false, error: err.message || 'send_failed' }
        }
      }
      const result = await rawSendImage(imageData, options)
      if (result.success) showSuccess('sent_successfully')
      else showWarning(toErrorToastKey(result.error))
      return result
    },
    [currentAI, activeTabId, autoSend, rawSendImage, showSuccess, showWarning]
  )

  return {
    sendTextToAI,
    sendImageToAI
  }
}

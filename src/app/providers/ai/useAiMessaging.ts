import { useCallback, useMemo } from 'react'
import { useAiSender } from '@features/ai/hooks/useAiSender'
import type { AiSendOptions } from '@features/ai'
import type { AiPlatform } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

interface UseAiMessagingParams {
  webviewInstance: WebviewController | null
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
  webviewInstance,
  currentAI,
  activeTabId,
  autoSend,
  aiRegistry,
  showSuccess,
  showWarning
}: UseAiMessagingParams) {
  const webviewRefProxy = useMemo(() => ({ current: webviewInstance }), [webviewInstance])
  const { sendTextToAI: rawSendText, sendImageToAI: rawSendImage } = useAiSender(
    webviewRefProxy,
    currentAI,
    autoSend,
    aiRegistry,
    activeTabId
  )

  const sendTextToAI = useCallback(
    async (text: string, options?: AiSendOptions) => {
      const result = await rawSendText(text, options)
      if (!result.success) {
        showWarning(toErrorToastKey(result.error))
      }
      return result
    },
    [rawSendText, showWarning]
  )

  const sendImageToAI = useCallback(
    async (imageData: string, options?: AiSendOptions) => {
      const result = await rawSendImage(imageData, options)
      if (result.success) {
        showSuccess('sent_successfully')
      } else {
        showWarning(toErrorToastKey(result.error))
      }
      return result
    },
    [rawSendImage, showSuccess, showWarning]
  )

  return {
    sendTextToAI,
    sendImageToAI
  }
}

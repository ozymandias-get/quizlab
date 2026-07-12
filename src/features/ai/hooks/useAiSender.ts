import type { AiPlatform } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

import {
  useGenerateAutoSendScript,
  useGenerateClickSendScript,
  useGenerateFocusScript,
  useGenerateWaitForSubmitReadyScript
} from '@platform/electron/api/useAutomationApi'
import { useCopyImageToClipboard } from '@platform/electron/api/useSystemApi'

import { useQueryClient } from '@tanstack/react-query'
import { type RefObject, useCallback, useRef } from 'react'

import {
  cancelWebviewSends,
  type ConfigCache,
  isWebviewUsable,
  queueForWebview,
  type UseAiSenderReturn
} from '../lib/aiSenderSupport'
import { handlePipelineError } from '../lib/handlePipelineError'
import {
  attachDiagnostics,
  createSendDiagnostics,
  nowMs,
  roundMs
} from '../lib/send/sendDiagnostics'
import { resolveAutoSend } from '../lib/sendUtils'
import type { AiSendOptions, SendImageResult, SendTextResult } from '../model/types'
import { usePrompts } from './usePrompts'
import { useTextInputMode } from './useTextInputMode'

/** A registry entry that satisfies the selector shape required by the send pipeline. */
type SenderRegistry = Record<string, AiPlatform>

export function useAiSender(
  webviewRef: RefObject<WebviewController | null>,
  currentAI: string,
  autoSend: boolean,
  aiRegistry: SenderRegistry | null,
  activeTabId?: string
): UseAiSenderReturn {
  const { activePromptText } = usePrompts()
  const { textInputMode, typingSpeed } = useTextInputMode()
  const queryClient = useQueryClient()
  const { mutateAsync: generateAutoSendScript } = useGenerateAutoSendScript()
  const { mutateAsync: generateFocusScript } = useGenerateFocusScript()
  const { mutateAsync: generateClickSendScript } = useGenerateClickSendScript()
  const { mutateAsync: generateWaitForSubmitReadyScript } = useGenerateWaitForSubmitReadyScript()
  const { mutateAsync: copyImageToClipboard } = useCopyImageToClipboard()
  const configCache = useRef<ConfigCache>({ key: null, cache: null })

  const canUseWebview = useCallback(
    (webview: WebviewController, expected?: WebviewController | null) =>
      isWebviewUsable(webviewRef, webview, expected),
    [webviewRef]
  )

  /**
   * Mevcut webview'e bağlı tüm bekleyen/işleyen gönderimleri iptal eder.
   * Yeni bir istek tetiklendiğinde `queueForWebview` zaten otomatik
   * çağırıyor; bu metod kullanıcının "iptal" butonuna basması durumunda
   * manuel tetikleme içindir.
   */
  const cancelOngoing = useCallback(() => {
    const webview = webviewRef.current
    if (webview) cancelWebviewSends(webview)
  }, [webviewRef])

  const sendTextToAI = useCallback(
    (text: string, options: AiSendOptions = {}): Promise<SendTextResult> => {
      const scheduledWebview = webviewRef.current
      const requestStartedAt = nowMs()
      const effectiveAutoSend = resolveAutoSend(autoSend, options)
      const diagnostics = createSendDiagnostics({
        pipeline: 'text',
        currentAI,
        activeTabId,
        autoSend: effectiveAutoSend
      })

      if (!scheduledWebview || !text.trim()) {
        return Promise.resolve(
          attachDiagnostics(
            {
              success: false,
              error: !scheduledWebview ? 'webview_not_ready' : 'empty_text'
            },
            diagnostics,
            requestStartedAt
          )
        )
      }

      const execute = async (webview: WebviewController): Promise<SendTextResult> => {
        diagnostics.timings.queueWaitMs = roundMs(nowMs() - requestStartedAt)

        try {
          const { executeTextSendPipeline } = await import('../lib/send/textSendPipeline')
          return await executeTextSendPipeline({
            webviewRef,
            webview,
            scheduledWebview,
            aiRegistry,
            currentAI,
            queryClient,
            configCache: configCache.current,
            activePromptText,
            promptText: options.promptText,
            text,
            effectiveAutoSend,
            textInputMode,
            typingSpeed,
            requestStartedAt,
            diagnostics,
            canUseWebview,
            generateAutoSendScript
          })
        } catch (error) {
          return handlePipelineError(error, diagnostics, requestStartedAt, 'Text pipeline')
        }
      }

      return queueForWebview(scheduledWebview, async () => {
        try {
          return await execute(scheduledWebview)
        } catch (error) {
          return handlePipelineError(error, diagnostics, requestStartedAt, 'Text queue')
        }
      })
    },
    [
      activePromptText,
      activeTabId,
      aiRegistry,
      autoSend,
      canUseWebview,
      currentAI,
      generateAutoSendScript,
      queryClient,
      textInputMode,
      typingSpeed,
      webviewRef,
      handlePipelineError
    ]
  )

  const sendImageToAI = useCallback(
    (imageDataUrl: string, options: AiSendOptions = {}): Promise<SendImageResult> => {
      const scheduledWebview = webviewRef.current
      const requestStartedAt = nowMs()
      const effectiveAutoSend = resolveAutoSend(autoSend, options)
      const diagnostics = createSendDiagnostics({
        pipeline: 'image',
        currentAI,
        activeTabId,
        autoSend: effectiveAutoSend
      })

      if (!scheduledWebview || !imageDataUrl.trim()) {
        return Promise.resolve(
          attachDiagnostics(
            { success: false, error: 'invalid_input' },
            diagnostics,
            requestStartedAt
          )
        )
      }

      const execute = async (webview: WebviewController): Promise<SendImageResult> => {
        diagnostics.timings.queueWaitMs = roundMs(nowMs() - requestStartedAt)

        try {
          const { executeImageSendPipeline } = await import('../lib/send/imageSendPipeline')
          return await executeImageSendPipeline({
            webviewRef,
            webview,
            scheduledWebview,
            aiRegistry,
            currentAI,
            queryClient,
            configCache: configCache.current,
            activePromptText,
            promptText: options.promptText,
            appendPromptAfterPaste: options.appendPromptAfterPaste,
            imageDataUrl,
            effectiveAutoSend,
            textInputMode,
            typingSpeed,
            requestStartedAt,
            diagnostics,
            canUseWebview,
            copyImageToClipboard,
            generateAutoSendScript,
            generateFocusScript,
            generateWaitForSubmitReadyScript,
            generateClickSendScript
          })
        } catch (error) {
          return handlePipelineError(error, diagnostics, requestStartedAt, 'Image pipeline')
        }
      }

      return queueForWebview(scheduledWebview, async () => {
        try {
          return await execute(scheduledWebview)
        } catch (error) {
          return handlePipelineError(error, diagnostics, requestStartedAt, 'Image queue')
        }
      })
    },
    [
      activePromptText,
      activeTabId,
      aiRegistry,
      autoSend,
      canUseWebview,
      copyImageToClipboard,
      currentAI,
      generateAutoSendScript,
      generateClickSendScript,
      generateFocusScript,
      generateWaitForSubmitReadyScript,
      queryClient,
      textInputMode,
      typingSpeed,
      webviewRef,
      handlePipelineError
    ]
  )

  return { sendTextToAI, sendImageToAI, cancelOngoing }
}

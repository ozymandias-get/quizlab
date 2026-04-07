import { useCallback, useRef, type RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Logger } from '@shared/lib/logger'
import type { WebviewController } from '@shared-core/types/webview'
import type { AiSendOptions, SendImageResult, SendTextResult } from '../model/types'
import {
  isWebviewUsable,
  queueForWebview,
  normalizeSendErrorCode,
  type AiConfig,
  type ConfigCache,
  type UseAiSenderReturn
} from '../lib/aiSenderSupport'
import { usePrompts } from './usePrompts'
import {
  useGenerateAutoSendScript,
  useGenerateClickSendScript,
  useGenerateFocusScript,
  useGenerateWaitForSubmitReadyScript
} from '@platform/electron/api/useAutomationApi'
import { useCopyImageToClipboard } from '@platform/electron/api/useSystemApi'
import { createSendDiagnostics, attachDiagnostics, nowMs, roundMs } from '../lib/send/sendDiagnostics'
import { executeTextSendPipeline } from '../lib/send/textSendPipeline'
import { executeImageSendPipeline } from '../lib/send/imageSendPipeline'

export function useAiSender(
  webviewRef: RefObject<WebviewController | null>,
  currentAI: string,
  autoSend: boolean,
  aiRegistry: Record<string, AiConfig> | null,
  activeTabId?: string
): UseAiSenderReturn {
  const { activePromptText } = usePrompts()
  const queryClient = useQueryClient()
  const { mutateAsync: generateAutoSendScript } = useGenerateAutoSendScript()
  const { mutateAsync: generateFocusScript } = useGenerateFocusScript()
  const { mutateAsync: generateClickSendScript } = useGenerateClickSendScript()
  const { mutateAsync: generateWaitForSubmitReadyScript } = useGenerateWaitForSubmitReadyScript()
  const { mutateAsync: copyImageToClipboard } = useCopyImageToClipboard()
  const configCache = useRef<ConfigCache>({ key: null, data: null })

  const canUseWebview = useCallback(
    (webview: WebviewController, expected?: WebviewController | null) =>
      isWebviewUsable(webviewRef, webview, expected),
    [webviewRef]
  )

  const sendTextToAI = useCallback(
    (text: string, options: AiSendOptions = {}): Promise<SendTextResult> => {
      const scheduledWebview = webviewRef.current
      const requestStartedAt = nowMs()
      const effectiveAutoSend =
        options.forceAutoSend === true ? true : (options.autoSend ?? autoSend)
      const diagnostics = createSendDiagnostics({
        pipeline: 'text',
        currentAI,
        activeTabId,
        autoSend: effectiveAutoSend
      })

      if (!scheduledWebview || !text) {
        return Promise.resolve(
          attachDiagnostics(
            { success: false, error: 'invalid_input' },
            diagnostics,
            requestStartedAt
          )
        )
      }

      const execute = async (webview: WebviewController): Promise<SendTextResult> => {
        diagnostics.timings.queueWaitMs = roundMs(nowMs() - requestStartedAt)

        try {
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
            requestStartedAt,
            diagnostics,
            canUseWebview,
            generateAutoSendScript
          })
        } catch (error) {
          const raw = error instanceof Error ? error.message : String(error)
          Logger.error('[useAiSender] Hata:', error)
          return attachDiagnostics(
            {
              success: false,
              error: normalizeSendErrorCode(raw, 'send_failed')
            },
            diagnostics,
            requestStartedAt
          )
        }
      }

      return queueForWebview(scheduledWebview, async () => {
        try {
          return await execute(scheduledWebview)
        } catch (error) {
          const raw = error instanceof Error ? error.message : String(error)
          return attachDiagnostics(
            {
              success: false,
              error: normalizeSendErrorCode(raw, 'send_failed')
            },
            diagnostics,
            requestStartedAt
          )
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
      webviewRef
    ]
  )

  const sendImageToAI = useCallback(
    (imageDataUrl: string, options: AiSendOptions = {}): Promise<SendImageResult> => {
      const scheduledWebview = webviewRef.current
      const requestStartedAt = nowMs()
      const effectiveAutoSend =
        options.forceAutoSend === true ? true : (options.autoSend ?? autoSend)
      const diagnostics = createSendDiagnostics({
        pipeline: 'image',
        currentAI,
        activeTabId,
        autoSend: effectiveAutoSend
      })

      if (!scheduledWebview || !imageDataUrl) {
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
          const raw = error instanceof Error ? error.message : String(error)
          Logger.error('[useAiSender] Image send error:', error)
          return attachDiagnostics(
            {
              success: false,
              error: normalizeSendErrorCode(raw, 'send_failed')
            },
            diagnostics,
            requestStartedAt
          )
        }
      }

      return queueForWebview(scheduledWebview, async () => {
        try {
          return await execute(scheduledWebview)
        } catch (error) {
          Logger.error('[useAiSender] Image queue error:', error)
          const raw = error instanceof Error ? error.message : String(error)
          return attachDiagnostics(
            {
              success: false,
              error: normalizeSendErrorCode(raw, 'send_failed')
            },
            diagnostics,
            requestStartedAt
          )
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
      webviewRef
    ]
  )

  return { sendTextToAI, sendImageToAI }
}

import type { AiPlatform } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

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
  cancelContentSends,
  type ConfigCache,
  isContentUsable,
  queueForContent,
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
  contentRef: RefObject<AiContentController | null>,
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

  const canUseContent = useCallback(
    (content: AiContentController, expected?: AiContentController | null) =>
      isContentUsable(contentRef, content, expected),
    [contentRef]
  )

  /**
   * Mevcut content'e bağlı tüm bekleyen/işleyen gönderimleri iptal eder.
   * Yeni bir istek tetiklendiğinde `queueForContent` zaten otomatik
   * çağırıyor; bu metod kullanıcının "iptal" butonuna basması durumunda
   * manuel tetikleme içindir.
   */
  const cancelOngoing = useCallback(() => {
    const content = contentRef.current
    if (content) cancelContentSends(content)
  }, [contentRef])

  const sendTextToAI = useCallback(
    (text: string, options: AiSendOptions = {}): Promise<SendTextResult> => {
      const scheduledContent = contentRef.current
      const requestStartedAt = nowMs()
      const effectiveAutoSend = resolveAutoSend(autoSend, options)
      const diagnostics = createSendDiagnostics({
        pipeline: 'text',
        currentAI,
        activeTabId,
        autoSend: effectiveAutoSend
      })

      if (!scheduledContent || !text.trim()) {
        return Promise.resolve(
          attachDiagnostics(
            {
              success: false,
              error: !scheduledContent ? 'webview_not_ready' : 'empty_text'
            },
            diagnostics,
            requestStartedAt
          )
        )
      }

      const execute = async (content: AiContentController): Promise<SendTextResult> => {
        diagnostics.timings.queueWaitMs = roundMs(nowMs() - requestStartedAt)

        try {
          const { executeTextSendPipeline } = await import('../lib/send/textSendPipeline')
          return await executeTextSendPipeline({
            contentRef,
            content,
            scheduledContent,
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
            canUseContent,
            generateAutoSendScript
          })
        } catch (error) {
          return handlePipelineError(error, diagnostics, requestStartedAt, 'Text pipeline')
        }
      }

      return queueForContent(scheduledContent, async () => {
        try {
          return await execute(scheduledContent)
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
      canUseContent,
      currentAI,
      generateAutoSendScript,
      queryClient,
      textInputMode,
      typingSpeed,
      contentRef
    ]
  )

  const sendImageToAI = useCallback(
    (imageDataUrl: string, options: AiSendOptions = {}): Promise<SendImageResult> => {
      const scheduledContent = contentRef.current
      const requestStartedAt = nowMs()
      const effectiveAutoSend = resolveAutoSend(autoSend, options)
      const diagnostics = createSendDiagnostics({
        pipeline: 'image',
        currentAI,
        activeTabId,
        autoSend: effectiveAutoSend
      })

      if (!scheduledContent || !imageDataUrl.trim()) {
        return Promise.resolve(
          attachDiagnostics(
            { success: false, error: 'invalid_input' },
            diagnostics,
            requestStartedAt
          )
        )
      }

      const execute = async (content: AiContentController): Promise<SendImageResult> => {
        diagnostics.timings.queueWaitMs = roundMs(nowMs() - requestStartedAt)

        try {
          const { executeImageSendPipeline } = await import('../lib/send/imageSendPipeline')
          return await executeImageSendPipeline({
            contentRef,
            content,
            scheduledContent,
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
            canUseContent,
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

      return queueForContent(scheduledContent, async () => {
        try {
          return await execute(scheduledContent)
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
      canUseContent,
      copyImageToClipboard,
      currentAI,
      generateAutoSendScript,
      generateClickSendScript,
      generateFocusScript,
      generateWaitForSubmitReadyScript,
      queryClient,
      textInputMode,
      typingSpeed,
      contentRef
    ]
  )

  const sendBulkToAI = useCallback(
    (imageDataUrls: string[], options: AiSendOptions = {}): Promise<SendImageResult> => {
      const scheduledContent = contentRef.current
      const requestStartedAt = nowMs()
      const effectiveAutoSend = resolveAutoSend(autoSend, options)
      const diagnostics = createSendDiagnostics({
        pipeline: 'image',
        currentAI,
        activeTabId,
        autoSend: effectiveAutoSend
      })

      if (!scheduledContent || imageDataUrls.length === 0) {
        return Promise.resolve(
          attachDiagnostics(
            { success: false, error: 'invalid_input' },
            diagnostics,
            requestStartedAt
          )
        )
      }

      const execute = async (content: AiContentController): Promise<SendImageResult> => {
        diagnostics.timings.queueWaitMs = roundMs(nowMs() - requestStartedAt)

        try {
          const { executeBulkSendPipeline } = await import('../lib/send/bulkSendPipeline')
          return await executeBulkSendPipeline({
            contentRef,
            content,
            scheduledContent,
            aiRegistry,
            currentAI,
            queryClient,
            configCache: configCache.current,
            activePromptText,
            promptText: options.promptText,
            appendPromptAfterPaste: options.appendPromptAfterPaste,
            imageDataUrls,
            effectiveAutoSend,
            textInputMode,
            typingSpeed,
            requestStartedAt,
            diagnostics,
            canUseContent,
            copyImageToClipboard,
            generateAutoSendScript,
            generateFocusScript,
            generateWaitForSubmitReadyScript,
            generateClickSendScript
          })
        } catch (error) {
          return handlePipelineError(error, diagnostics, requestStartedAt, 'Bulk pipeline')
        }
      }

      return queueForContent(scheduledContent, async () => {
        try {
          return await execute(scheduledContent)
        } catch (error) {
          return handlePipelineError(error, diagnostics, requestStartedAt, 'Bulk queue')
        }
      })
    },
    [
      activePromptText,
      activeTabId,
      aiRegistry,
      autoSend,
      canUseContent,
      copyImageToClipboard,
      currentAI,
      generateAutoSendScript,
      generateClickSendScript,
      generateFocusScript,
      generateWaitForSubmitReadyScript,
      queryClient,
      textInputMode,
      typingSpeed,
      contentRef
    ]
  )

  return { sendTextToAI, sendImageToAI, sendBulkToAI, cancelOngoing }
}

import type { AiPlatform, TextInputMode } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import { safeContentPaste } from '@shared/lib/aiContentUtils'
import { Logger, reportSuppressedError } from '@shared/lib/logger'

import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'

import type { AiSendDiagnostics, SendImageResult } from '../../model/types'
import {
  type ConfigCache,
  IMAGE_SUBMIT_READY_SETTLE_DELAY,
  IMAGE_SUBMIT_READY_TIMEOUT_BUFFER,
  IMAGE_UPLOAD_WAIT_DELAY,
  POST_PASTE_PROMPT_DELAY,
  sleep,
  toAutomationConfig
} from '../aiSenderSupport'
import { mergePromptText } from '../aiSenderSupport'
import { reportSelectorRepair } from '../selectorRepair/reportSelectorRepair'
import { copyImageToClipboardWithRetry, createClipboardRestore } from './imageClipboard'
import { isPasteIgnoredByPage, reportSubmitReadyFailure } from './imageSendSubmitDiagnosis'
import { executePipelineStep } from './pipelineUtils'
import { isSendError, resolveSendContext } from './resolveSendContext'
import { cloneScriptDiagnostics } from './scriptExecution'
import { attachDiagnostics, nowMs, roundMs } from './sendDiagnostics'

interface BulkSendPipelineParams {
  contentRef: RefObject<AiContentController | null>
  content: AiContentController
  scheduledContent: AiContentController
  aiRegistry: Record<string, AiPlatform> | null
  currentAI: string
  queryClient: QueryClient
  configCache: ConfigCache
  activePromptText: string | null
  /** Birleştirilmiş gövde + not (kaynak başlıkları dahil, kayıtlı prompt hariç). */
  promptText?: string
  appendPromptAfterPaste?: boolean
  /** Tek mesajın tüm görsel ekleri (sıralı, data: URL). */
  imageDataUrls: string[]
  effectiveAutoSend: boolean
  textInputMode: TextInputMode
  typingSpeed: number
  requestStartedAt: number
  diagnostics: AiSendDiagnostics
  canUseContent: (content: AiContentController, expected?: AiContentController | null) => boolean
  copyImageToClipboard: (imageDataUrl: string) => Promise<boolean>
  generateAutoSendScript: (params: {
    config: ReturnType<typeof toAutomationConfig>
    text: string
    submit: boolean
    append?: boolean
    textInputMode?: TextInputMode
    typingSpeed?: number
  }) => Promise<string | null>
  generateFocusScript: (config: ReturnType<typeof toAutomationConfig>) => Promise<string | null>
  generateWaitForSubmitReadyScript: (params: {
    config: ReturnType<typeof toAutomationConfig>
    options?: { timeoutMs?: number; settleMs?: number; minimumWaitMs?: number }
  }) => Promise<string | null>
  generateClickSendScript: (config: ReturnType<typeof toAutomationConfig>) => Promise<string | null>
}

/**
 * Çoklu görseli tek AI mesajı olarak gönderir: tüm ekler sırayla
 * yapıştırılır, prompt yalnızca bir kez eklenir, tek submit yapılır.
 *
 * Magic Selector onarım mekanizması korunur (tek rapor, fire-and-forget).
 * Hazır olmadan submit yapılmaz: tüm yapıştırmalardan sonra tek
 * submit-ready beklemesi koşar (görsel sayısına göre ölçeklenir).
 */
export async function executeBulkSendPipeline(
  params: BulkSendPipelineParams
): Promise<SendImageResult> {
  const {
    contentRef,
    content,
    scheduledContent,
    aiRegistry,
    currentAI,
    queryClient,
    configCache,
    activePromptText,
    promptText,
    appendPromptAfterPaste,
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
  } = params

  if (imageDataUrls.length === 0) {
    return attachDiagnostics(
      { success: false, error: 'invalid_input' },
      diagnostics,
      requestStartedAt
    )
  }
  for (const url of imageDataUrls) {
    if (!url.startsWith('data:image/')) {
      Logger.error('[bulkSend] Invalid image format')
      return attachDiagnostics(
        { success: false, error: 'invalid_image_format' },
        diagnostics,
        requestStartedAt
      )
    }
  }

  const resolveStartedAt = nowMs()
  const resolved = await resolveSendContext({
    contentRef,
    content,
    scheduledContent,
    aiRegistry,
    currentAI,
    queryClient,
    configCache
  })
  diagnostics.timings.configResolveMs = roundMs(nowMs() - resolveStartedAt)

  if (isSendError(resolved)) {
    if (resolved.actualUrl) diagnostics.currentUrl = resolved.actualUrl
    return attachDiagnostics(resolved, diagnostics, requestStartedAt)
  }

  diagnostics.currentUrl = resolved.currentUrl
  const effectivePromptText = mergePromptText(activePromptText, promptText)
  // N görsel için bekleme bütçesi doğrusal ölçeklenir (tavanlı).
  const perImageWait = Math.max(
    resolved.aiConfig.imageWaitTime ?? IMAGE_UPLOAD_WAIT_DELAY,
    IMAGE_UPLOAD_WAIT_DELAY
  )
  const minimumReadyWaitMs = Math.min(perImageWait * Math.max(1, imageDataUrls.length), 8000)
  const submitReadyTimeoutMs = minimumReadyWaitMs + IMAGE_SUBMIT_READY_TIMEOUT_BUFFER
  let promptApplied = false

  const reportRepair = () => {
    void reportSelectorRepair({
      aiConfig: resolved.aiConfig,
      currentUrl: resolved.currentUrl,
      diagnostics,
      queryClient,
      configCache
    })
  }

  const clipboard = createClipboardRestore()

  try {
    try {
      if (content.isDestroyed?.() !== true && typeof content.focus === 'function') {
        await content.focus()
      }
    } catch (err) {
      reportSuppressedError('bulkSend.contentFocus', { cause: err })
    }

    const focusStep = await executePipelineStep<SendImageResult>({
      name: 'Focus',
      content,
      scheduledContent,
      diagnostics,
      requestStartedAt,
      canUseContent,
      generateScript: () => generateFocusScript(toAutomationConfig(resolved.aiConfig)),
      onTiming: (ms) => (diagnostics.timings.focusScriptGenerationMs = ms),
      onExecuteTiming: (ms) => (diagnostics.timings.focusExecuteJavaScriptMs = ms),
      onResult: (res) => (diagnostics.focusScript = cloneScriptDiagnostics(res?.diagnostics))
    })
    if (!focusStep.success) return focusStep.error

    // Tüm görseller sırayla yapıştırılır — ara submit yok.
    const pasteStartedAt = nowMs()
    for (let i = 0; i < imageDataUrls.length; i++) {
      const imageDataUrl = imageDataUrls[i]
      if (!canUseContent(content, scheduledContent)) {
        return attachDiagnostics(
          { success: false, error: 'webview_destroyed' },
          diagnostics,
          requestStartedAt
        )
      }
      const copied = await copyImageToClipboardWithRetry({
        copyImageToClipboard,
        imageDataUrl,
        diagnostics
      })
      if (!copied) {
        return attachDiagnostics(
          { success: false, error: 'clipboard_failed' },
          diagnostics,
          requestStartedAt
        )
      }

      let pasteSuccess = false
      if (canUseContent(content, scheduledContent) && typeof content.paste === 'function') {
        try {
          pasteSuccess = await content.paste()
        } catch (err) {
          reportSuppressedError('bulkSend.nativePaste', { cause: err })
          pasteSuccess = false
        }
      }
      if (!pasteSuccess) {
        if (!canUseContent(content, scheduledContent)) {
          return attachDiagnostics(
            { success: false, error: 'webview_destroyed' },
            diagnostics,
            requestStartedAt
          )
        }
        pasteSuccess = await safeContentPaste(content)
      }
      if (!pasteSuccess) {
        return attachDiagnostics(
          { success: false, error: 'paste_failed' },
          diagnostics,
          requestStartedAt
        )
      }
      // Site asenkron işliyorsa bir sonraki yapıştırmadan önce kısa nefes.
      if (i < imageDataUrls.length - 1) {
        await sleep(400)
      }
    }
    diagnostics.timings.pasteMs = roundMs(nowMs() - pasteStartedAt)
    clipboard.markPasteCompleted()
    await clipboard.restore()

    // Prompt yalnızca bir kez.
    if (effectivePromptText) {
      const refocusStep = await executePipelineStep<SendImageResult>({
        name: 'Focus',
        content,
        scheduledContent,
        diagnostics,
        requestStartedAt,
        canUseContent,
        generateScript: () => generateFocusScript(toAutomationConfig(resolved.aiConfig)),
        onTiming: (ms) => (diagnostics.timings.refocusScriptGenerationMs = ms),
        onExecuteTiming: (ms) => (diagnostics.timings.refocusExecuteJavaScriptMs = ms),
        onResult: (res) => (diagnostics.refocusScript = cloneScriptDiagnostics(res?.diagnostics))
      })
      if (!refocusStep.success) return refocusStep.error

      await sleep(POST_PASTE_PROMPT_DELAY)
      diagnostics.timings.postPastePromptDelayMs = POST_PASTE_PROMPT_DELAY

      const shouldAppendPromptAfterPaste =
        resolved.aiConfig.appendPromptAfterPaste !== false && appendPromptAfterPaste !== false

      const promptStep = await executePipelineStep<SendImageResult>({
        name: 'Script',
        content,
        scheduledContent,
        diagnostics,
        requestStartedAt,
        canUseContent,
        generateScript: () =>
          generateAutoSendScript({
            config: toAutomationConfig(resolved.aiConfig),
            text: effectivePromptText,
            submit: false,
            append: shouldAppendPromptAfterPaste,
            textInputMode,
            typingSpeed
          }),
        onTiming: (ms) => (diagnostics.timings.promptScriptGenerationMs = ms),
        onExecuteTiming: (ms) => (diagnostics.timings.promptExecuteJavaScriptMs = ms),
        onResult: (res) => (diagnostics.promptScript = cloneScriptDiagnostics(res?.diagnostics))
      })
      if (!promptStep.success) return promptStep.error

      promptApplied = true
      if (!effectiveAutoSend) {
        reportRepair()
        return attachDiagnostics(
          { success: true, mode: 'paste_and_prompt' },
          diagnostics,
          requestStartedAt
        )
      }
    } else if (!effectiveAutoSend) {
      reportRepair()
      return attachDiagnostics({ success: true, mode: 'paste_only' }, diagnostics, requestStartedAt)
    }

    if (effectiveAutoSend) {
      const submitReadyStep = await executePipelineStep<SendImageResult>({
        name: 'Submit_ready',
        content,
        scheduledContent,
        diagnostics,
        requestStartedAt,
        canUseContent,
        generateScript: () =>
          generateWaitForSubmitReadyScript({
            config: toAutomationConfig(resolved.aiConfig),
            options: {
              timeoutMs: submitReadyTimeoutMs,
              settleMs: IMAGE_SUBMIT_READY_SETTLE_DELAY,
              minimumWaitMs: minimumReadyWaitMs
            }
          }),
        onTiming: (ms) => (diagnostics.timings.submitReadyScriptGenerationMs = ms),
        onExecuteTiming: (ms) => (diagnostics.timings.submitReadyExecuteJavaScriptMs = ms),
        onResult: (res) => {
          diagnostics.submitReadyScript = cloneScriptDiagnostics(res?.diagnostics)
          diagnostics.timings.imageUploadWaitMs = roundMs(
            res?.diagnostics?.totalMs ??
              diagnostics.timings.submitReadyExecuteJavaScriptMs ??
              minimumReadyWaitMs
          )
        }
      })
      if (!submitReadyStep.success) {
        const pasteIgnoredPage = isPasteIgnoredByPage(submitReadyStep.scriptResult)
        reportSubmitReadyFailure({
          step: submitReadyStep,
          platformId: currentAI,
          currentUrl: resolved.currentUrl,
          minimumReadyWaitMs,
          submitReadyTimeoutMs,
          clipboardRestored: !clipboard.pending,
          pasteIgnoredPage,
          diagnostics
        })
        if (pasteIgnoredPage) {
          return attachDiagnostics(
            { success: false, error: 'paste_not_applied' },
            diagnostics,
            requestStartedAt
          ) as SendImageResult
        }
        return submitReadyStep.error
      }

      const clickStep = await executePipelineStep<SendImageResult>({
        name: 'Click',
        content,
        scheduledContent,
        diagnostics,
        requestStartedAt,
        canUseContent,
        generateScript: () => generateClickSendScript(toAutomationConfig(resolved.aiConfig)),
        onTiming: (ms) => (diagnostics.timings.clickScriptGenerationMs = ms),
        onExecuteTiming: (ms) => (diagnostics.timings.clickExecuteJavaScriptMs = ms),
        onResult: (res) => (diagnostics.clickScript = cloneScriptDiagnostics(res?.diagnostics))
      })
      if (!clickStep.success) {
        return attachDiagnostics(
          { success: false, error: 'autosend_failed_draft_saved' },
          diagnostics,
          requestStartedAt
        )
      }

      reportRepair()
      return attachDiagnostics(
        { success: true, mode: promptApplied ? 'auto_click_with_prompt' : 'auto_click' },
        diagnostics,
        requestStartedAt
      )
    }

    reportRepair()
    return attachDiagnostics({ success: true, mode: 'paste_only' }, diagnostics, requestStartedAt)
  } finally {
    await clipboard.restore()
  }
}

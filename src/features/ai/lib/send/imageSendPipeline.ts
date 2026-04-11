import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'
import { Logger, reportSuppressedError } from '@shared/lib/logger'
import { safeWebviewPaste } from '@shared/lib/webviewUtils'
import type { WebviewController } from '@shared-core/types/webview'
import type { AiSendDiagnostics, SendImageResult } from '../../model/types'
import {
  CLIPBOARD_WAIT_DELAY,
  IMAGE_SUBMIT_READY_SETTLE_DELAY,
  IMAGE_SUBMIT_READY_TIMEOUT_BUFFER,
  IMAGE_UPLOAD_WAIT_DELAY,
  POST_PASTE_PROMPT_DELAY,
  sleep,
  toAutomationConfig,
  type AiConfig,
  type ConfigCache
} from '../aiSenderSupport'
import { mergePromptText } from '../aiSenderSupport'
import { cloneScriptDiagnostics } from './scriptExecution'
import { attachDiagnostics, nowMs, roundMs } from './sendDiagnostics'
import { isSendError, resolveSendContext } from './resolveSendContext'
import { executePipelineStep } from './pipelineUtils'

interface ImageSendPipelineParams {
  webviewRef: RefObject<WebviewController | null>
  webview: WebviewController
  scheduledWebview: WebviewController
  aiRegistry: Record<string, AiConfig> | null
  currentAI: string
  queryClient: QueryClient
  configCache: ConfigCache
  activePromptText: string | null
  promptText?: string
  appendPromptAfterPaste?: boolean
  imageDataUrl: string
  effectiveAutoSend: boolean
  requestStartedAt: number
  diagnostics: AiSendDiagnostics
  canUseWebview: (webview: WebviewController, expected?: WebviewController | null) => boolean
  copyImageToClipboard: (imageDataUrl: string) => Promise<boolean>
  generateAutoSendScript: (params: {
    config: ReturnType<typeof toAutomationConfig>
    text: string
    submit: boolean
    append?: boolean
  }) => Promise<string | null>
  generateFocusScript: (config: ReturnType<typeof toAutomationConfig>) => Promise<string | null>
  generateWaitForSubmitReadyScript: (params: {
    config: ReturnType<typeof toAutomationConfig>
    options?: { timeoutMs?: number; settleMs?: number; minimumWaitMs?: number }
  }) => Promise<string | null>
  generateClickSendScript: (config: ReturnType<typeof toAutomationConfig>) => Promise<string | null>
}

export async function executeImageSendPipeline(
  params: ImageSendPipelineParams
): Promise<SendImageResult> {
  const {
    webviewRef,
    webview,
    scheduledWebview,
    aiRegistry,
    currentAI,
    queryClient,
    configCache,
    activePromptText,
    promptText,
    appendPromptAfterPaste,
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
  } = params

  if (!imageDataUrl.startsWith('data:image/')) {
    Logger.error('[useAiSender] Invalid image format')
    return attachDiagnostics(
      { success: false, error: 'invalid_image_format' },
      diagnostics,
      requestStartedAt
    )
  }

  const resolveStartedAt = nowMs()
  const resolved = await resolveSendContext({
    webviewRef,
    webview,
    scheduledWebview,
    aiRegistry,
    currentAI,
    queryClient,
    configCache
  })
  diagnostics.timings.configResolveMs = roundMs(nowMs() - resolveStartedAt)

  if (isSendError(resolved)) {
    if (resolved.actualUrl) {
      diagnostics.currentUrl = resolved.actualUrl
    }
    return attachDiagnostics(resolved, diagnostics, requestStartedAt)
  }

  diagnostics.currentUrl = resolved.currentUrl
  const effectivePromptText = mergePromptText(activePromptText, promptText)
  const minimumReadyWaitMs = Math.max(
    resolved.aiConfig.imageWaitTime || IMAGE_UPLOAD_WAIT_DELAY,
    IMAGE_UPLOAD_WAIT_DELAY
  )
  const submitReadyTimeoutMs = minimumReadyWaitMs + IMAGE_SUBMIT_READY_TIMEOUT_BUFFER
  let promptApplied = false

  const clipboardStartedAt = nowMs()
  const copied = await copyImageToClipboard(imageDataUrl)
  diagnostics.timings.clipboardMs = roundMs(nowMs() - clipboardStartedAt)
  if (!copied) {
    return attachDiagnostics(
      { success: false, error: 'clipboard_failed' },
      diagnostics,
      requestStartedAt
    )
  }

  try {
    if (webview.isDestroyed?.() !== true && typeof webview.focus === 'function') {
      webview.focus()
    }
  } catch (err) {
    reportSuppressedError('imageSend.webviewFocus', { cause: err })
  }

  await sleep(100)

  // 1. Initial Focus
  const focusStep = await executePipelineStep<SendImageResult>({
    name: 'Focus',
    webview,
    scheduledWebview,
    diagnostics,
    requestStartedAt,
    canUseWebview,
    generateScript: () => generateFocusScript(toAutomationConfig(resolved.aiConfig)),
    onTiming: (ms) => (diagnostics.timings.focusScriptGenerationMs = ms),
    onExecuteTiming: (ms) => (diagnostics.timings.focusExecuteJavaScriptMs = ms),
    onResult: (res) => (diagnostics.focusScript = cloneScriptDiagnostics(res?.diagnostics))
  })
  if (!focusStep.success) return focusStep.error

  await sleep(CLIPBOARD_WAIT_DELAY)

  // 2. Paste Image
  let pasteSuccess = false
  const pasteStartedAt = nowMs()
  if (
    canUseWebview(webview, scheduledWebview) &&
    typeof webview.pasteNative === 'function' &&
    typeof webview.getWebContentsId === 'function'
  ) {
    try {
      const webContentsId = webview.getWebContentsId()
      if (webContentsId) {
        const result = webview.pasteNative(webContentsId)
        pasteSuccess = typeof result === 'boolean' ? result : await result
      }
    } catch (err) {
      reportSuppressedError('imageSend.nativePaste', { cause: err })
      pasteSuccess = false
    }
  }

  if (!pasteSuccess) {
    if (!canUseWebview(webview, scheduledWebview)) {
      return attachDiagnostics(
        { success: false, error: 'webview_destroyed' },
        diagnostics,
        requestStartedAt
      )
    }
    pasteSuccess = safeWebviewPaste(webview)
  }
  diagnostics.timings.pasteMs = roundMs(nowMs() - pasteStartedAt)

  if (!pasteSuccess) {
    return attachDiagnostics(
      { success: false, error: 'paste_failed' },
      diagnostics,
      requestStartedAt
    )
  }

  // 3. Optional Prompt
  if (effectivePromptText) {
    const refocusStep = await executePipelineStep<SendImageResult>({
      name: 'Focus',
      webview,
      scheduledWebview,
      diagnostics,
      requestStartedAt,
      canUseWebview,
      generateScript: () => generateFocusScript(toAutomationConfig(resolved.aiConfig)),
      onTiming: (ms) => (diagnostics.timings.refocusScriptGenerationMs = ms),
      onExecuteTiming: (ms) => (diagnostics.timings.refocusExecuteJavaScriptMs = ms),
      onResult: (res) => (diagnostics.refocusScript = cloneScriptDiagnostics(res?.diagnostics))
    })
    if (!refocusStep.success) return refocusStep.error

    await sleep(280 + POST_PASTE_PROMPT_DELAY)
    diagnostics.timings.postPastePromptDelayMs = POST_PASTE_PROMPT_DELAY

    const shouldAppendPromptAfterPaste =
      resolved.aiConfig.appendPromptAfterPaste !== false && appendPromptAfterPaste !== false

    const promptStep = await executePipelineStep<SendImageResult>({
      name: 'Script',
      webview,
      scheduledWebview,
      diagnostics,
      requestStartedAt,
      canUseWebview,
      generateScript: () =>
        generateAutoSendScript({
          config: toAutomationConfig(resolved.aiConfig),
          text: effectivePromptText,
          submit: false,
          append: shouldAppendPromptAfterPaste
        }),
      onTiming: (ms) => (diagnostics.timings.promptScriptGenerationMs = ms),
      onExecuteTiming: (ms) => (diagnostics.timings.promptExecuteJavaScriptMs = ms),
      onResult: (res) => (diagnostics.promptScript = cloneScriptDiagnostics(res?.diagnostics))
    })

    if (!promptStep.success) return promptStep.error

    promptApplied = true
    if (!effectiveAutoSend) {
      return attachDiagnostics(
        { success: true, mode: 'paste_and_prompt' },
        diagnostics,
        requestStartedAt
      )
    }
  }

  // 4. Auto-send (Wait for upload + Click)
  if (effectiveAutoSend) {
    const submitReadyStep = await executePipelineStep<SendImageResult>({
      name: 'Submit_ready',
      webview,
      scheduledWebview,
      diagnostics,
      requestStartedAt,
      canUseWebview,
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
      if (submitReadyStep.scriptResult?.error) {
        return submitReadyStep.error
      }
      return attachDiagnostics(
        { success: false, error: 'submit_not_ready' },
        diagnostics,
        requestStartedAt
      )
    }

    const clickStep = await executePipelineStep<SendImageResult>({
      name: 'Click',
      webview,
      scheduledWebview,
      diagnostics,
      requestStartedAt,
      canUseWebview,
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

    return attachDiagnostics(
      { success: true, mode: promptApplied ? 'auto_click_with_prompt' : 'auto_click' },
      diagnostics,
      requestStartedAt
    )
  }

  return attachDiagnostics({ success: true, mode: 'paste_only' }, diagnostics, requestStartedAt)
}

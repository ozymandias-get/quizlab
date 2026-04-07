import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'
import { Logger } from '@shared/lib/logger'
import { safeWebviewPaste } from '@shared/lib/webviewUtils'
import type { WebviewController } from '@shared-core/types/webview'
import type { AiSendDiagnostics, SendImageResult } from '../../model/types'
import {
  CLIPBOARD_WAIT_DELAY,
  IMAGE_SUBMIT_READY_SETTLE_DELAY,
  IMAGE_SUBMIT_READY_TIMEOUT_BUFFER,
  IMAGE_UPLOAD_WAIT_DELAY,
  POST_PASTE_PROMPT_DELAY,
  normalizeSendErrorCode,
  sleep,
  toAutomationConfig,
  type AiConfig,
  type ConfigCache
} from '../aiSenderSupport'
import { mergePromptText } from '../aiSenderSupport'
import { cloneScriptDiagnostics, normalizeExecutionResult } from './scriptExecution'
import { attachDiagnostics, nowMs, roundMs } from './sendDiagnostics'
import { isSendError, resolveSendContext } from './resolveSendContext'

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

export async function executeImageSendPipeline({
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
}: ImageSendPipelineParams): Promise<SendImageResult> {
  if (!imageDataUrl.startsWith('data:image/')) {
    Logger.error('[useAiSender] Invalid image format')
    return attachDiagnostics({ success: false, error: 'invalid_image_format' }, diagnostics, requestStartedAt)
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
    return attachDiagnostics({ success: false, error: 'clipboard_failed' }, diagnostics, requestStartedAt)
  }

  try {
    if (webview.isDestroyed?.() !== true && typeof webview.focus === 'function') {
      webview.focus()
    }
  } catch {}

  await sleep(100)

  const focusScriptGenerationStartedAt = nowMs()
  const focusScript = await generateFocusScript(toAutomationConfig(resolved.aiConfig))
  diagnostics.timings.focusScriptGenerationMs = roundMs(nowMs() - focusScriptGenerationStartedAt)
  if (!focusScript) {
    return attachDiagnostics({ success: false, error: 'focus_script_failed' }, diagnostics, requestStartedAt)
  }

  if (!canUseWebview(webview, scheduledWebview)) {
    return attachDiagnostics({ success: false, error: 'webview_destroyed' }, diagnostics, requestStartedAt)
  }

  const focusExecuteStartedAt = nowMs()
  const rawFocusResult = await webview.executeJavaScript(focusScript)
  diagnostics.timings.focusExecuteJavaScriptMs = roundMs(nowMs() - focusExecuteStartedAt)
  const focusResult = normalizeExecutionResult(rawFocusResult)
  diagnostics.focusScript = cloneScriptDiagnostics(focusResult?.diagnostics)
  if (!focusResult?.success) {
    return attachDiagnostics(
      { success: false, error: normalizeSendErrorCode(focusResult?.error, 'focus_failed') },
      diagnostics,
      requestStartedAt
    )
  }

  await sleep(CLIPBOARD_WAIT_DELAY)

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
    } catch {
      pasteSuccess = false
    }
  }

  if (!pasteSuccess) {
    if (!canUseWebview(webview, scheduledWebview)) {
      return attachDiagnostics({ success: false, error: 'webview_destroyed' }, diagnostics, requestStartedAt)
    }
    pasteSuccess = safeWebviewPaste(webview)
  }
  diagnostics.timings.pasteMs = roundMs(nowMs() - pasteStartedAt)

  if (!pasteSuccess) {
    return attachDiagnostics({ success: false, error: 'paste_failed' }, diagnostics, requestStartedAt)
  }

  if (effectivePromptText) {
    const refocusScriptGenerationStartedAt = nowMs()
    const refocusScript = await generateFocusScript(toAutomationConfig(resolved.aiConfig))
    diagnostics.timings.refocusScriptGenerationMs = roundMs(nowMs() - refocusScriptGenerationStartedAt)
    if (!refocusScript) {
      return attachDiagnostics({ success: false, error: 'focus_script_failed' }, diagnostics, requestStartedAt)
    }

    if (!canUseWebview(webview, scheduledWebview)) {
      return attachDiagnostics({ success: false, error: 'webview_destroyed' }, diagnostics, requestStartedAt)
    }

    const refocusExecuteStartedAt = nowMs()
    const rawRefocusResult = await webview.executeJavaScript(refocusScript)
    diagnostics.timings.refocusExecuteJavaScriptMs = roundMs(nowMs() - refocusExecuteStartedAt)
    const refocusResult = normalizeExecutionResult(rawRefocusResult)
    diagnostics.refocusScript = cloneScriptDiagnostics(refocusResult?.diagnostics)
    if (!refocusResult?.success) {
      return attachDiagnostics(
        { success: false, error: normalizeSendErrorCode(refocusResult?.error, 'focus_failed') },
        diagnostics,
        requestStartedAt
      )
    }

    await sleep(280)

    await sleep(POST_PASTE_PROMPT_DELAY)
    diagnostics.timings.postPastePromptDelayMs = POST_PASTE_PROMPT_DELAY

    const promptScriptGenerationStartedAt = nowMs()
    const shouldAppendPromptAfterPaste =
      resolved.aiConfig.appendPromptAfterPaste !== false && appendPromptAfterPaste !== false
    const promptScript = await generateAutoSendScript({
      config: toAutomationConfig(resolved.aiConfig),
      text: effectivePromptText,
      submit: false,
      append: shouldAppendPromptAfterPaste
    })
    diagnostics.timings.promptScriptGenerationMs = roundMs(nowMs() - promptScriptGenerationStartedAt)

    if (promptScript) {
      if (!canUseWebview(webview, scheduledWebview)) {
        return attachDiagnostics({ success: false, error: 'webview_destroyed' }, diagnostics, requestStartedAt)
      }

      const promptExecuteStartedAt = nowMs()
      const rawPromptResult = await webview.executeJavaScript(promptScript)
      diagnostics.timings.promptExecuteJavaScriptMs = roundMs(nowMs() - promptExecuteStartedAt)
      const promptResult = normalizeExecutionResult(rawPromptResult)
      diagnostics.promptScript = cloneScriptDiagnostics(promptResult?.diagnostics)
      if (!promptResult?.success) {
        return attachDiagnostics(
          { success: false, error: normalizeSendErrorCode(promptResult?.error, 'script_failed') },
          diagnostics,
          requestStartedAt
        )
      }

      promptApplied = true

      if (!effectiveAutoSend) {
        return attachDiagnostics({ success: true, mode: 'paste_and_prompt' }, diagnostics, requestStartedAt)
      }
    }
  }

  if (effectiveAutoSend) {
    const submitReadyScriptGenerationStartedAt = nowMs()
    const submitReadyScript = await generateWaitForSubmitReadyScript({
      config: toAutomationConfig(resolved.aiConfig),
      options: {
        timeoutMs: submitReadyTimeoutMs,
        settleMs: IMAGE_SUBMIT_READY_SETTLE_DELAY,
        minimumWaitMs: minimumReadyWaitMs
      }
    })
    diagnostics.timings.submitReadyScriptGenerationMs = roundMs(
      nowMs() - submitReadyScriptGenerationStartedAt
    )
    if (!submitReadyScript) {
      return attachDiagnostics(
        { success: false, error: 'submit_ready_script_failed' },
        diagnostics,
        requestStartedAt
      )
    }

    if (!canUseWebview(webview, scheduledWebview)) {
      return attachDiagnostics({ success: false, error: 'webview_destroyed' }, diagnostics, requestStartedAt)
    }

    const submitReadyExecuteStartedAt = nowMs()
    const rawSubmitReadyResult = await webview.executeJavaScript(submitReadyScript)
    diagnostics.timings.submitReadyExecuteJavaScriptMs = roundMs(nowMs() - submitReadyExecuteStartedAt)
    const submitReadyResult = normalizeExecutionResult(rawSubmitReadyResult)
    diagnostics.submitReadyScript = cloneScriptDiagnostics(submitReadyResult?.diagnostics)
    diagnostics.timings.imageUploadWaitMs = roundMs(
      submitReadyResult?.diagnostics?.totalMs ??
        diagnostics.timings.submitReadyExecuteJavaScriptMs ??
        minimumReadyWaitMs
    )
    if (!submitReadyResult?.success) {
      return attachDiagnostics(
        { success: false, error: normalizeSendErrorCode(submitReadyResult?.error, 'submit_not_ready') },
        diagnostics,
        requestStartedAt
      )
    }

    const clickScriptGenerationStartedAt = nowMs()
    const clickScript = await generateClickSendScript(toAutomationConfig(resolved.aiConfig))
    diagnostics.timings.clickScriptGenerationMs = roundMs(nowMs() - clickScriptGenerationStartedAt)
    if (!clickScript) {
      return attachDiagnostics({ success: false, error: 'click_script_failed' }, diagnostics, requestStartedAt)
    }

    if (!canUseWebview(webview, scheduledWebview)) {
      return attachDiagnostics({ success: false, error: 'webview_destroyed' }, diagnostics, requestStartedAt)
    }

    const clickExecuteStartedAt = nowMs()
    const rawClickResult = await webview.executeJavaScript(clickScript)
    diagnostics.timings.clickExecuteJavaScriptMs = roundMs(nowMs() - clickExecuteStartedAt)
    const clickResult = normalizeExecutionResult(rawClickResult)
    diagnostics.clickScript = cloneScriptDiagnostics(clickResult?.diagnostics)
    if (!clickResult?.success) {
      return attachDiagnostics(
        {
          success: false,
          error: normalizeSendErrorCode(clickResult?.error, 'autosend_failed_draft_saved')
        },
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

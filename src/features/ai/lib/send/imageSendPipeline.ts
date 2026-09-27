import type { AiPlatform, AutomationExecutionResult, TextInputMode } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

import { getElectronApi } from '@shared/lib/electronApi'
import { Logger, reportSuppressedError } from '@shared/lib/logger'
import { safeWebviewPaste } from '@shared/lib/webviewUtils'

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
import { executePipelineStep } from './pipelineUtils'
import { isSendError, resolveSendContext } from './resolveSendContext'
import { cloneScriptDiagnostics } from './scriptExecution'
import { attachDiagnostics, nowMs, roundMs } from './sendDiagnostics'

interface ImageSendPipelineParams {
  webviewRef: RefObject<WebviewController | null>
  webview: WebviewController
  scheduledWebview: WebviewController
  aiRegistry: Record<string, AiPlatform> | null
  currentAI: string
  queryClient: QueryClient
  configCache: ConfigCache
  activePromptText: string | null
  promptText?: string
  appendPromptAfterPaste?: boolean
  imageDataUrl: string
  effectiveAutoSend: boolean
  textInputMode: TextInputMode
  typingSpeed: number
  requestStartedAt: number
  diagnostics: AiSendDiagnostics
  canUseWebview: (webview: WebviewController, expected?: WebviewController | null) => boolean
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
 * Explains a submit-ready timeout in one line.
 *
 * The user-visible error is a single generic "still processing" string, so
 * without this the only way to tell a genuinely slow upload from a stale
 * selector or a failed paste is to reproduce it by hand. Emitted at `warn` so it
 * reaches both the in-app issue-report buffer and the production disk log.
 */
function logSubmitReadyFailure(params: {
  step: { error?: unknown; scriptResult?: AutomationExecutionResult | null }
  platformId: string
  currentUrl: string
  minimumReadyWaitMs: number
  submitReadyTimeoutMs: number
  clipboardRestored: boolean
  pasteIgnoredPage: boolean
  diagnostics: AiSendDiagnostics
}): void {
  const { step, currentUrl, diagnostics } = params
  const result = step.scriptResult
  const failure = step.error as { error?: string } | undefined

  const detail = {
    platform: params.platformId,
    url: currentUrl,
    errorCode: failure?.error ?? result?.error ?? 'unknown',
    notReadyTarget: result?.notReadyTarget,
    notReadyReason: result?.notReadyReason,
    // never-ready + no DOM movement == the paste attached nothing
    everReady: result?.everReady,
    mutationCount: result?.mutationCount,
    checkIterations: result?.checkIterations,
    waitedMs: result?.waitedMs ?? diagnostics.timings.imageUploadWaitMs,
    budgetMs: result?.budgetMs ?? params.submitReadyTimeoutMs,
    platformMinWaitMs: params.minimumReadyWaitMs,
    clipboardRestored: params.clipboardRestored,
    pasteIgnoredPage: params.pasteIgnoredPage,
    pasteMs: diagnostics.timings.pasteMs,
    clipboardMs: diagnostics.timings.clipboardMs,
    submitReadyExecuteMs: diagnostics.timings.submitReadyExecuteJavaScriptMs
  }

  // `submit_not_ready` means the element was found but stayed un-interactive.
  // Surface it as a warning so it is not lost in the noise of info logs.
  Logger.warn('[imageSend] submit-ready gave up', JSON.stringify(detail))
  reportSuppressedError('imageSend.submitNotReady', { cause: new Error(JSON.stringify(detail)) })
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
    resolved.aiConfig.imageWaitTime ?? IMAGE_UPLOAD_WAIT_DELAY,
    IMAGE_UPLOAD_WAIT_DELAY
  )
  const submitReadyTimeoutMs = minimumReadyWaitMs + IMAGE_SUBMIT_READY_TIMEOUT_BUFFER
  let promptApplied = false

  /**
   * Self-healing: the image pipeline runs several injected scripts, and only
   * the ones that actually used an element (`promptScript` inserted text,
   * `clickScript` submitted) may teach the selector repair loop anything.
   * Fire-and-forget so a repair never delays or fails the send.
   */
  const reportRepair = () => {
    void reportSelectorRepair({
      aiConfig: resolved.aiConfig,
      currentUrl: resolved.currentUrl,
      diagnostics,
      queryClient,
      configCache
    })
  }

  const clipboardStartedAt = nowMs()
  let copied = false
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      copied = await copyImageToClipboard(imageDataUrl)
      if (copied) break
    } catch (clipboardError) {
      reportSuppressedError('imageSend.clipboardCopy', { cause: clipboardError })
    }
    if (attempt < 2) {
      await sleep(100 * (attempt + 1))
    }
  }
  diagnostics.timings.clipboardMs = roundMs(nowMs() - clipboardStartedAt)
  if (!copied) {
    return attachDiagnostics(
      { success: false, error: 'clipboard_failed' },
      diagnostics,
      requestStartedAt
    )
  }

  let pasteCompleted = false
  let clipboardRestorePending = true
  const restoreClipboard = async () => {
    if (!clipboardRestorePending) return
    clipboardRestorePending = false
    try {
      if (pasteCompleted) await sleep(700)
      await getElectronApi()?.restoreClipboard?.()
    } catch (restoreError) {
      reportSuppressedError('imageSend.clipboardRestore', { cause: restoreError })
    }
  }

  try {
    try {
      if (webview.isDestroyed?.() !== true && typeof webview.focus === 'function') {
        webview.focus()
      }
    } catch (err) {
      reportSuppressedError('imageSend.webviewFocus', { cause: err })
    }

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
          pasteSuccess = await result
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
    pasteCompleted = true
    await restoreClipboard()

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

      await sleep(POST_PASTE_PROMPT_DELAY)
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
        const scriptResult = submitReadyStep.scriptResult
        // Zero DOM mutations and a target that was never interactive means the
        // paste never reached the page at all. Reporting the generic
        // `submit_not_ready` ("still processing") would have the user waiting
        // on something that can never finish.
        const pasteIgnoredPage =
          scriptResult?.everReady === false && (scriptResult?.mutationCount ?? 0) === 0

        logSubmitReadyFailure({
          step: submitReadyStep,
          platformId: currentAI,
          currentUrl: resolved.currentUrl,
          minimumReadyWaitMs,
          submitReadyTimeoutMs,
          clipboardRestored: !clipboardRestorePending,
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
    await restoreClipboard()
  }
}

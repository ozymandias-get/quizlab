import type { AiPlatform, TextInputMode } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import { safeContentPaste } from '@shared/lib/aiContentUtils'
import { Logger, reportSuppressedError } from '@shared/lib/logger'

import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'

import type { AiSendDiagnostics, SendImageResult, SendStage } from '../../model/types'
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
import {
  attachDiagnostics,
  finalizeTotalMs,
  nowMs,
  recordScriptStageTimings,
  roundMs
} from './sendDiagnostics'

interface ImageSendPipelineParams {
  contentRef: RefObject<AiContentController | null>
  content: AiContentController
  scheduledContent: AiContentController
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
  canUseContent: (content: AiContentController, expected?: AiContentController | null) => boolean
  copyImageToClipboard: (imageDataUrl: string, scope?: string) => Promise<boolean>
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

export async function executeImageSendPipeline(
  params: ImageSendPipelineParams
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
   * Hedefe **gerçekte ne bırakıldığı** izlenir; karar hata kodundan değil
   * bundan okunur. `paste_failed` tek görselde "hiç yapışmadı" demektir
   * (güvenli tekrar), `paste_not_applied` ise "yapıştırma gönderildi ama
   * sayfa uygulamış mı bilmiyoruz" demektir (belirsiz → tekrar yapılmaz).
   */
  let stage: SendStage = 'not_started'

  /** Sonucu, o anki gerçek aşamayla birlikte döndürür. */
  const finish = (result: SendImageResult): SendImageResult => ({ ...result, stage })

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

  // Snapshot sahipliği kopyalamadan ÖNCE açılır: tüm kopyalar aynı scope'u
  // taşır ve kopyalama başarısız olsa bile defter `finally`de kapanır.
  const clipboard = createClipboardRestore(diagnostics)

  try {
    const copied = await copyImageToClipboardWithRetry({
      copyImageToClipboard,
      imageDataUrl,
      scope: clipboard.scopeId,
      diagnostics
    })
    if (!copied) {
      return finish(
        attachDiagnostics(
          { success: false, error: 'clipboard_failed' },
          diagnostics,
          requestStartedAt
        )
      )
    }

    try {
      if (content.isDestroyed?.() !== true && typeof content.focus === 'function') {
        await content.focus()
      }
    } catch (err) {
      reportSuppressedError('imageSend.contentFocus', { cause: err })
    }

    // 1. Initial Focus
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
    if (!focusStep.success) return finish(focusStep.error)

    // 2. Paste Image
    let pasteSuccess = false
    const pasteStartedAt = nowMs()
    if (canUseContent(content, scheduledContent) && typeof content.paste === 'function') {
      try {
        pasteSuccess = await content.paste()
      } catch (err) {
        reportSuppressedError('imageSend.nativePaste', { cause: err })
        pasteSuccess = false
      }
    }

    if (!pasteSuccess) {
      if (!canUseContent(content, scheduledContent)) {
        return finish(
          attachDiagnostics(
            { success: false, error: 'webview_destroyed' },
            diagnostics,
            requestStartedAt
          )
        )
      }
      pasteSuccess = await safeContentPaste(content)
    }
    diagnostics.timings.pasteMs = roundMs(nowMs() - pasteStartedAt)

    if (!pasteSuccess) {
      // Yapıştırma gerçekleşmedi → hedefe hiçbir şey bırakılmadı.
      return finish(
        attachDiagnostics({ success: false, error: 'paste_failed' }, diagnostics, requestStartedAt)
      )
    }
    clipboard.markPasteCompleted()
    // Restore arka planda başlatılır (settle + IPC); kritik yolda beklenmez.
    // `finally` aynı promise'i await eder, yani pano her koşulda ve en fazla
    // bir kez geri yüklenir; prompt/submit adımları bu süreyi beklemez.
    void clipboard.restore()
    // Görsel hedefe girdi; bundan sonraki her hata kısmi uygulamadır.
    stage = 'partial'

    // 3. Optional Prompt
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
      if (!refocusStep.success) return finish(refocusStep.error)

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
        onResult: (res) => {
          diagnostics.promptScript = cloneScriptDiagnostics(res?.diagnostics)
          recordScriptStageTimings(diagnostics, diagnostics.promptScript)
        }
      })

      if (!promptStep.success) return finish(promptStep.error)

      promptApplied = true
      stage = 'applied'
      if (!effectiveAutoSend) {
        reportRepair()
        return finish(
          attachDiagnostics(
            { success: true, mode: 'paste_and_prompt' },
            diagnostics,
            requestStartedAt
          )
        )
      }
    }

    // 4. Auto-send (Wait for upload + Click)
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
          // Submit-ready beklemesi ayrı ölçülür: süre + ilk hazır-olma anı.
          if (res?.diagnostics) {
            diagnostics.timings.submitReadyMs = roundMs(res.diagnostics.submitMs)
          }
          diagnostics.timings.submitReadyFirstReadyMs = res?.firstReadyAtMs ?? null
        }
      })
      if (!submitReadyStep.success) {
        // Reporting the generic `submit_not_ready` ("still processing") when the
        // paste never landed would have the user waiting on something that can
        // never finish.
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
          // Sayfa yapıştırırmayı yok saydı **diye** anladık; doğrulayamadık.
          // Görsel gerçekten düşmüş olabilir, bu yüzden sonuç "belirsiz"dir ve
          // otomatik tekrar yapılmaz.
          stage = 'uncertain'
          return finish(
            attachDiagnostics(
              { success: false, error: 'paste_not_applied' },
              diagnostics,
              requestStartedAt
            ) as SendImageResult
          )
        }
        return finish(submitReadyStep.error)
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
        onResult: (res) => {
          diagnostics.clickScript = cloneScriptDiagnostics(res?.diagnostics)
          recordScriptStageTimings(diagnostics, diagnostics.clickScript)
        }
      })
      if (!clickStep.success) {
        return finish(
          attachDiagnostics(
            { success: false, error: 'autosend_failed_draft_saved' },
            diagnostics,
            requestStartedAt
          )
        )
      }

      reportRepair()
      stage = 'applied'
      return finish(
        attachDiagnostics(
          { success: true, mode: promptApplied ? 'auto_click_with_prompt' : 'auto_click' },
          diagnostics,
          requestStartedAt
        )
      )
    }

    reportRepair()
    stage = 'applied'
    return finish(
      attachDiagnostics({ success: true, mode: 'paste_only' }, diagnostics, requestStartedAt)
    )
  } finally {
    // Restore'un kritik yolda gerçekten bloke ettiği süre ayrı ölçülür: settle
    // ve IPC arka planda başlatıldığı için bu sayı genelde ~0'dır ve paralel
    // kazancı (toplam restore süresi = clipboardRestoreMs) görünür kılar.
    const restoreWaitStartedAt = nowMs()
    await clipboard.restore()
    diagnostics.timings.clipboardRestoreWaitMs = roundMs(nowMs() - restoreWaitStartedAt)
    // `attachDiagnostics` çıkış anında hesaplanan totalMs'i ez: `finally`
    // (pano geri yükleme) pipeline'ın parçasıdır ve toplam süreye dahil olmalı.
    finalizeTotalMs(diagnostics, requestStartedAt)
  }
}

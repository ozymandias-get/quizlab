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

/**
 * Çoklu görseli tek AI mesajı olarak gönderir: tüm ekler sırayla
 * yapıştırılır, prompt yalnızca bir kez eklenir, tek submit yapılır.
 *
 * Magic Selector onarım mekanizması korunur (tek rapor, fire-and-forget).
 * Görseller arasında sabit bekleme yoktur: her yapıştırmadan sonra submit-ready
 * betiği ile gerçek hazır olma doğrulaması yapılır, yalnızca alan hazırsa
 * sıradaki ek yapıştırılır. Submit'ten önce de tek bir submit-ready beklemesi
 * koşar (görsel sayısına göre ölçeklenir).
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

  /**
   * Hedefe **gerçekte ne bırakıldığı**, hatadan bağımsız olarak izlenir.
   *
   * `paste_failed` kodu ilk görselde dönerse hedef boştur (güvenli tekrar);
   * üçüncü görselde dönerse ilk ikisi kutunun içindedir (tekrar mükerrer
   * mesaj üretir). Aynı kod, iki farklı gerçeği anlattığı için karar hata
   * kodundan değil **buradan** okunur.
   */
  let stage: SendStage = 'not_started'

  /** Sonucu, o anki gerçek aşamayla birlikte döndürür. */
  const finish = (result: SendImageResult): SendImageResult => ({ ...result, stage })

  const reportRepair = () => {
    void reportSelectorRepair({
      aiConfig: resolved.aiConfig,
      currentUrl: resolved.currentUrl,
      diagnostics,
      queryClient,
      configCache
    })
  }

  const clipboard = createClipboardRestore(diagnostics)

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
    if (!focusStep.success) return finish(focusStep.error)

    // Tüm görseller sırayla yapıştırılır — ara submit yok.
    const pasteStartedAt = nowMs()
    for (let i = 0; i < imageDataUrls.length; i++) {
      const imageDataUrl = imageDataUrls[i]
      if (!canUseContent(content, scheduledContent)) {
        return finish(
          attachDiagnostics(
            { success: false, error: 'webview_destroyed' },
            diagnostics,
            requestStartedAt
          )
        )
      }
      const copied = await copyImageToClipboardWithRetry({
        copyImageToClipboard,
        imageDataUrl,
        // Tek gönderim = tek snapshot: tüm görseller aynı kapsamı taşır,
        // restore bir kez ve yalnızca bu gönderimin girdisini çözer.
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
      if (!pasteSuccess) {
        return finish(
          attachDiagnostics(
            { success: false, error: 'paste_failed' },
            diagnostics,
            requestStartedAt
          )
        )
      }
      // Bu görsel hedefe girdi. Bundan sonraki **her** hata "kısmi uygulama"
      // anlamına gelir: aynı görselleri tekrar göndermek kutuda ikinci kopya
      // bırakır, bu yüzden aşama burada bir kez ve yükseltilerek sabitlenir.
      stage = 'partial'
      // Site asenkron işliyorsa bir sonraki yapıştırmadan önce gerçek hazır
      // olma doğrulaması: sabit milisaniye beklemiyoruz. Submit-ready betiği
      // giriş alanının/butonun etkileşime hazır olduğunu DOM üzerinden doğrular
      // (MutationObserver ile), böylece her ek gerçekten işlendikten sonra
      // sıradaki yapıştırma yapılır.
      if (i < imageDataUrls.length - 1) {
        const betweenPasteStep = await executePipelineStep<SendImageResult>({
          name: 'Paste_ready',
          content,
          scheduledContent,
          diagnostics,
          requestStartedAt,
          canUseContent,
          generateScript: () =>
            generateWaitForSubmitReadyScript({
              config: toAutomationConfig(resolved.aiConfig),
              options: {
                timeoutMs: Math.max(2000, perImageWait),
                settleMs: 300,
                minimumWaitMs: 300
              }
            }),
          onTiming: (ms) => {
            diagnostics.timings.submitReadyScriptGenerationMs = ms
          },
          onExecuteTiming: (ms) => {
            diagnostics.timings.submitReadyExecuteJavaScriptMs =
              (diagnostics.timings.submitReadyExecuteJavaScriptMs ?? 0) + ms
          },
          onResult: () => {
            // Ara adım: ek bir diagnostics alanı tutmaz.
          }
        })
        if (!betweenPasteStep.success) {
          // Yapıştırma sonrası alan hazır değil: kör bekleme yerine dur.
          // Taslak korunur (caller), sessizce devam edilmez.
          return finish(betweenPasteStep.error)
        }
      }
    }
    diagnostics.timings.pasteMs = roundMs(nowMs() - pasteStartedAt)
    clipboard.markPasteCompleted()
    // Restore arka planda başlatılır; kritik yolda beklenmez. `finally` aynı
    // (memoize edilmiş) promise'i await eder: pano en fazla bir kez geri
    // yüklenir ve ilk hata yolunda bile garanti edilir.
    void clipboard.restore()

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
      // Prompt da yazıldı: içerik hedefte tam olarak duruyor.
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
    } else if (!effectiveAutoSend) {
      reportRepair()
      stage = 'applied'
      return finish(
        attachDiagnostics({ success: true, mode: 'paste_only' }, diagnostics, requestStartedAt)
      )
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
          // Submit-ready beklemesi ayrı ölçülür: süre + ilk hazır-olma anı.
          if (res?.diagnostics) {
            diagnostics.timings.submitReadyMs = roundMs(res.diagnostics.submitMs)
          }
          diagnostics.timings.submitReadyFirstReadyMs = res?.firstReadyAtMs ?? null
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

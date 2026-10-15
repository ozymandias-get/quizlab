import type { AiPlatform } from '@shared-core/types'
import type { TextInputMode } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'

import type {
  AiSendDiagnostics,
  SendStage,
  SendSubmitOutcome,
  SendTextResult
} from '../../model/types'
import type { ConfigCache } from '../aiSenderSupport'
import { toAutomationConfig } from '../aiSenderSupport'
import { buildPromptText, mergePromptText } from '../aiSenderSupport'
import { reportSelectorRepair } from '../selectorRepair/reportSelectorRepair'
import { executePipelineStep } from './pipelineUtils'
import { isSendError, resolveSendContext } from './resolveSendContext'
import { cloneScriptDiagnostics } from './scriptExecution'
import { attachDiagnostics, nowMs, recordScriptStageTimings, roundMs } from './sendDiagnostics'

interface TextSendPipelineParams {
  contentRef: RefObject<AiContentController | null>
  content: AiContentController
  scheduledContent: AiContentController
  aiRegistry: Record<string, AiPlatform> | null
  currentAI: string
  queryClient: QueryClient
  configCache: ConfigCache
  activePromptText: string | null
  promptText?: string
  text: string
  effectiveAutoSend: boolean
  textInputMode: TextInputMode
  typingSpeed: number
  requestStartedAt: number
  diagnostics: AiSendDiagnostics
  canUseContent: (content: AiContentController, expected?: AiContentController | null) => boolean
  generateAutoSendScript: (params: {
    config: ReturnType<typeof toAutomationConfig>
    text: string
    submit: boolean
    append?: boolean
    textInputMode?: TextInputMode
    typingSpeed?: number
  }) => Promise<string | null>
}

export async function executeTextSendPipeline(
  params: TextSendPipelineParams
): Promise<SendTextResult> {
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
    text,
    effectiveAutoSend,
    textInputMode,
    typingSpeed,
    requestStartedAt,
    diagnostics,
    canUseContent,
    generateAutoSendScript
  } = params

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

  const finalText = buildPromptText(text, mergePromptText(activePromptText, promptText))

  const sendStep = await executePipelineStep<SendTextResult>({
    name: 'Script',
    content,
    scheduledContent,
    diagnostics,
    requestStartedAt,
    canUseContent,
    generateScript: () =>
      generateAutoSendScript({
        config: toAutomationConfig(resolved.aiConfig),
        text: finalText,
        submit: effectiveAutoSend,
        append: true,
        textInputMode,
        typingSpeed
      }),
    onTiming: (ms) => (diagnostics.timings.scriptGenerationMs = ms),
    onExecuteTiming: (ms) => (diagnostics.timings.executeJavaScriptMs = ms),
    onResult: (res) => {
      diagnostics.script = cloneScriptDiagnostics(res?.diagnostics)
      recordScriptStageTimings(diagnostics, diagnostics.script)
    }
  })

  if (!sendStep.success) {
    // Metin gönderimi tek betikle yapar: betik girdi alanını bulur, metni yazar
    // ve gönderir. Betik **çalıştıysa** ve yalnızca sonra başarısız olduysa
    // hedefe dokunulmuştur; otomatik tekrar aynı metni ikinci kez yazar.
    // Betik hiç çalışmadıysa (`scriptResult` yok) veya alan hiç bulunmadıysa
    // hedef boştur ve tekrar güvenlidir.
    const code = sendStep.error.error
    const stage: SendStage =
      sendStep.scriptResult && code !== 'input_not_found' ? 'partial' : 'not_started'
    return { ...sendStep.error, stage }
  }

  // Self-healing: hand this send's diagnostics to the selector repair loop.
  // Fire-and-forget on purpose — a repair is a background improvement, so it
  // must not add latency to (or be able to fail) a successful send.
  void reportSelectorRepair({
    aiConfig: resolved.aiConfig,
    currentUrl: resolved.currentUrl,
    diagnostics,
    queryClient,
    configCache
  })

  // Submit kapalıysa metin yalnızca alana yazıldı: `submitMode` (click /
  // enter_key / mixed) gönderim *yapılandırmasını* tarif eder, sonucu değil.
  // O değeri olduğu gibi döndürmek "teslim edildi" gibi okunur ve kullanıcı
  // henüz göndermediği halde "Gönderildi" bildirimi gösterilir. Staged modu
  // açıkça bildirilir; auto-send açıkken script'in bildirdiği submit modu
  // korunur.
  if (!effectiveAutoSend) {
    return attachDiagnostics(
      { success: true, mode: 'staged', stage: 'applied', submitOutcome: 'input_only' },
      diagnostics,
      requestStartedAt
    )
  }

  // `success` burada yalnızca "gönderim GİRİŞİMİ yapıldı" demektir.
  // Teslimat doğrulandıysa `observed`, doğrulanamadıysa
  // `delivery_unconfirmed` taşınır; üst katman bu ayrımla kullanıcıya hem
  // "gönderildi" hem de "gönderildi ama teslimat doğrulanamadı" durumunu
  // doğru gösterebilir. Sessiz başarı üretilmez.
  const submitOutcome = resolveSubmitOutcome(sendStep.scriptResult)
  if (submitOutcome === 'delivery_unconfirmed') {
    return attachDiagnostics(
      {
        success: true,
        mode: sendStep.scriptResult?.mode || resolved.aiConfig.submitMode,
        stage: 'uncertain',
        submitOutcome
      },
      diagnostics,
      requestStartedAt
    )
  }

  return attachDiagnostics(
    {
      success: true,
      mode: sendStep.scriptResult?.mode || resolved.aiConfig.submitMode,
      stage: 'applied',
      submitOutcome
    },
    diagnostics,
    requestStartedAt
  )
}

/**
 * Betiğin gönderim sonucunu taşınabilir bir değere indirger.
 *
 * Betik alanı bildirmemişse (ör. enter_key yolunda etki gözlemlendi ama alan
 * doldurulmadı) `observed` kabul edilir: `success: true` zaten gönderim
 * girişiminin yapıldığını ifade eder ve gözlem alanı yalnızca belirsizliği
 * taşır.
 */
function resolveSubmitOutcome(
  scriptResult: { submitOutcome?: string | null } | null | undefined
): SendSubmitOutcome {
  const raw = scriptResult?.submitOutcome
  if (
    raw === 'observed' ||
    raw === 'delivery_unconfirmed' ||
    raw === 'blocked' ||
    raw === 'not_attempted' ||
    raw === 'input_only'
  ) {
    return raw
  }
  return 'observed'
}

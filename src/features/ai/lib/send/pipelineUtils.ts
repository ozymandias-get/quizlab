import type { AutomationExecutionResult } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

import type { AiErrorClassification, AiSendDiagnostics } from '../../model/types'
import { classifyAiSendError, isWebviewCancelled, normalizeSendErrorCode } from '../aiSenderSupport'
import { normalizeExecutionResult } from './scriptExecution'
import { attachDiagnostics, nowMs, roundMs } from './sendDiagnostics'

/**
 * Common logic for executing a step in the AI send pipeline.
 * Handles timing, script generation checks, webview availability, and diagnostic logging.
 */

export interface PipelineStepParams {
  name: string
  webview: WebviewController
  scheduledWebview: WebviewController
  diagnostics: AiSendDiagnostics
  requestStartedAt: number
  canUseWebview: (webview: WebviewController, expected?: WebviewController | null) => boolean
  generateScript: () => Promise<string | null>
  onTiming: (ms: number) => void
  onExecuteTiming: (ms: number) => void
  onResult: (executionResult: AutomationExecutionResult | null) => void
}

type PipelineStepResult<TFail> =
  | { success: true; scriptResult: AutomationExecutionResult | null }
  | { success: false; error: TFail; scriptResult?: AutomationExecutionResult | null }

export async function executePipelineStep<TFail>(
  params: PipelineStepParams
): Promise<PipelineStepResult<TFail>> {
  const {
    name,
    webview,
    scheduledWebview,
    diagnostics,
    requestStartedAt,
    canUseWebview,
    generateScript,
    onTiming,
    onExecuteTiming,
    onResult
  } = params

  const scriptStartedAt = nowMs()
  const script = await generateScript()
  const scriptGenMs = roundMs(nowMs() - scriptStartedAt)
  onTiming(scriptGenMs)

  if (!script) {
    const errorCode = `${name.toLowerCase()}_script_failed`
    diagnostics.classification = await classifyAiSendError(errorCode)
    return {
      success: false,
      error: attachDiagnostics(
        { success: false, error: errorCode },
        diagnostics,
        requestStartedAt
      ) as TFail
    }
  }

  if (!canUseWebview(webview, scheduledWebview)) {
    const errorCode = 'webview_destroyed'
    diagnostics.classification = await classifyAiSendError(errorCode)
    return {
      success: false,
      error: attachDiagnostics(
        { success: false, error: errorCode },
        diagnostics,
        requestStartedAt
      ) as TFail
    }
  }

  const executeStartedAt = nowMs()
  // İptal kontrolü: yeni bir istek geldiyse mevcut istek script
  // çağrısı yapmadan erken döner. Bu, hâlâ kuyrukta olan eski isteklerin
  // pahalı executeJavaScript çağrıları yapmasını engeller.
  if (isWebviewCancelled(webview)) {
    const errorCode = 'cancelled'
    diagnostics.classification = await classifyAiSendError(errorCode)
    return {
      success: false,
      error: attachDiagnostics(
        { success: false, error: errorCode },
        diagnostics,
        requestStartedAt
      ) as TFail
    }
  }
  const rawResult = await webview.executeJavaScript(script)
  const execMs = roundMs(nowMs() - executeStartedAt)
  onExecuteTiming(execMs)

  const scriptResult = normalizeExecutionResult(rawResult)
  onResult(scriptResult)

  if (!scriptResult || scriptResult.success === false) {
    const errorCode = normalizeSendErrorCode(scriptResult?.error, `${name.toLowerCase()}_failed`)
    const classification: AiErrorClassification = await classifyAiSendError(errorCode)
    // Sınıflandırma bilgisini diagnostics'e yaz; UI katmanı
    // toastKey / retry / triggerFallback alanlarına buradan ulaşır.
    diagnostics.classification = classification
    return {
      success: false,
      scriptResult,
      error: attachDiagnostics(
        { success: false, error: errorCode },
        diagnostics,
        requestStartedAt
      ) as TFail
    }
  }

  return { success: true, scriptResult }
}

import type { WebviewController } from '@shared-core/types/webview'
import { normalizeSendErrorCode } from '../aiSenderSupport'
import { normalizeExecutionResult } from './scriptExecution'
import { attachDiagnostics, nowMs, roundMs } from './sendDiagnostics'
import type { AiSendDiagnostics } from '../../model/types'

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
  onResult: (result: any) => void
}

export type PipelineStepResult<TFail> =
  | { success: true; scriptResult: any }
  | { success: false; error: TFail; scriptResult?: any }

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
  onTiming(roundMs(nowMs() - scriptStartedAt))

  if (!script) {
    return {
      success: false,
      error: attachDiagnostics(
        { success: false, error: `${name.toLowerCase()}_script_failed` },
        diagnostics,
        requestStartedAt
      ) as TFail
    }
  }

  if (!canUseWebview(webview, scheduledWebview)) {
    return {
      success: false,
      error: attachDiagnostics(
        { success: false, error: 'webview_destroyed' },
        diagnostics,
        requestStartedAt
      ) as TFail
    }
  }

  const executeStartedAt = nowMs()
  const rawResult = await webview.executeJavaScript(script)
  onExecuteTiming(roundMs(nowMs() - executeStartedAt))

  const scriptResult = normalizeExecutionResult(rawResult)
  onResult(scriptResult)

  if (!scriptResult || scriptResult.success === false) {
    return {
      success: false,
      scriptResult,
      error: attachDiagnostics(
        {
          success: false,
          error: normalizeSendErrorCode(scriptResult?.error, `${name.toLowerCase()}_failed`)
        },
        diagnostics,
        requestStartedAt
      ) as TFail
    }
  }

  return { success: true, scriptResult }
}

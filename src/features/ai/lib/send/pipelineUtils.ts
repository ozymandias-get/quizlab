import type { WebviewController } from '@shared-core/types/webview'
import type { AutomationExecutionResult } from '@shared-core/types'
import { normalizeSendErrorCode } from '../aiSenderSupport'
import { normalizeExecutionResult } from './scriptExecution'
import { attachDiagnostics, nowMs, roundMs } from './sendDiagnostics'
import type { AiSendDiagnostics } from '../../model/types'
import { useDiagnosticsStore } from '@features/diagnostics'
import type { PipelineStage } from '@features/diagnostics/model/types'

function nameToPipelineStage(name: string): PipelineStage {
  const map: Record<string, PipelineStage> = {
    Submit_ready: 'submit_ready'
  }
  return map[name] ?? (name.toLowerCase() as PipelineStage)
}

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
  onResult: (result: AutomationExecutionResult | null) => void
}

export type PipelineStepResult<TFail> =
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

  const emitEvent = useDiagnosticsStore.getState().emitEvent

  const scriptStartedAt = nowMs()
  const script = await generateScript()
  const scriptGenMs = roundMs(nowMs() - scriptStartedAt)
  onTiming(scriptGenMs)

  emitEvent({
    type: 'SCRIPT_GENERATED',
    provider: diagnostics.currentAI,
    severity: 'info',
    pipelineStage: 'script_generation',
    duration: scriptGenMs,
    message: `${name} script generated`
  })

  if (!script) {
    emitEvent({
      type: 'PIPELINE_ERROR',
      provider: diagnostics.currentAI,
      severity: 'error',
      pipelineStage: 'script_generation',
      message: `${name} script generation failed`
    })
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
    emitEvent({
      type: 'PIPELINE_ERROR',
      provider: diagnostics.currentAI,
      severity: 'error',
      pipelineStage: 'error',
      message: 'Webview destroyed during pipeline execution'
    })
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
  const execMs = roundMs(nowMs() - executeStartedAt)
  onExecuteTiming(execMs)

  emitEvent({
    type: name === 'Submit_ready' ? 'SUBMIT_READY' : 'SCRIPT_GENERATED',
    provider: diagnostics.currentAI,
    severity: 'info',
    pipelineStage: nameToPipelineStage(name),
    duration: execMs,
    message: `${name} script executed`
  })

  const scriptResult = normalizeExecutionResult(rawResult)
  onResult(scriptResult)

  if (!scriptResult || scriptResult.success === false) {
    emitEvent({
      type: 'PIPELINE_ERROR',
      provider: diagnostics.currentAI,
      severity: 'error',
      pipelineStage: 'script_execution',
      message: scriptResult?.error || `${name} execution failed`,
      duration: execMs
    })
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

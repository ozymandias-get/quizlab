import type { AiSendDiagnostics, SendImageResult, SendTextResult } from '../../model/types'

interface SendDiagnosticsOptions {
  pipeline: 'text' | 'image'
  currentAI: string
  activeTabId?: string
  autoSend: boolean
}

export function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

export function roundMs(value: number) {
  return Math.round(value * 100) / 100
}

export function createSendDiagnostics({
  pipeline,
  currentAI,
  activeTabId,
  autoSend
}: SendDiagnosticsOptions): AiSendDiagnostics {
  return {
    pipeline,
    tabId: activeTabId,
    currentAI,
    autoSend,
    timings: {
      queueWaitMs: 0,
      configResolveMs: 0,
      totalMs: 0
    }
  }
}

function finalizeDiagnostics(diagnostics: AiSendDiagnostics, requestStartedAt: number) {
  diagnostics.timings.totalMs = roundMs(nowMs() - requestStartedAt)
  return diagnostics
}

export function attachDiagnostics<T extends SendTextResult | SendImageResult>(
  result: T,
  diagnostics: AiSendDiagnostics,
  requestStartedAt: number
): T {
  return {
    ...result,
    diagnostics: finalizeDiagnostics(diagnostics, requestStartedAt)
  }
}

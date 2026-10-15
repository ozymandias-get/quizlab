import type { AutomationExecutionDiagnostics } from '@shared-core/types'

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

export function roundMs(ms: number) {
  return Math.round(ms * 100) / 100
}

/**
 * Betik diagnostics'inden aşama metriklerini çıkarır.
 *
 * Yalnızca adlandırılmış strateji/süre alanları taşınır; prompt metni, kullanıcı
 * içeriği veya sayfa verisi asla kopyalanmaz. Submit-ready betiği için
 * çağrılmaz: oradaki `submitMs` bekleme süresidir, submit tetikleme süresi
 * değildir (o alan ayrıca işlenir).
 */
export function recordScriptStageTimings(
  diagnostics: AiSendDiagnostics,
  script: AutomationExecutionDiagnostics | null | undefined
): void {
  if (!script) return
  const timings = diagnostics.timings

  const lookupMs = (script.input?.durationMs ?? 0) + (script.button?.durationMs ?? 0)
  if (lookupMs > 0) {
    timings.selectorLookupMs = roundMs((timings.selectorLookupMs ?? 0) + lookupMs)
  }
  if (script.setInputMs > 0) {
    timings.textInsertionMs = roundMs((timings.textInsertionMs ?? 0) + script.setInputMs)
  }
  if (script.submitMs > 0) {
    timings.submitTriggerMs = roundMs((timings.submitTriggerMs ?? 0) + script.submitMs)
  }
  if (script.textInputStrategy) {
    timings.textInputStrategy = script.textInputStrategy
  }
  if (script.textInputFallback) {
    timings.textInputFallback = script.textInputFallback
  }
  if (typeof script.preSubmitWaitMs === 'number' && script.preSubmitWaitMs > 0) {
    timings.preSubmitWaitMs = roundMs((timings.preSubmitWaitMs ?? 0) + script.preSubmitWaitMs)
  }
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
  sendResult: T,
  diagnostics: AiSendDiagnostics,
  requestStartedAt: number
): T & { diagnostics: AiSendDiagnostics } {
  return {
    ...sendResult,
    diagnostics: finalizeDiagnostics(diagnostics, requestStartedAt)
  }
}

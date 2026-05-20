import type { DiagnosticsEvent, TelemetryMetrics } from '../model/types'

let lastComputedAt = 0
let cachedMetrics: TelemetryMetrics | null = null
let lastEventCount = 0

export function computeTelemetryMetrics(
  events: DiagnosticsEvent[],
  totalSends: number,
  averageSendTime: number,
  now: number,
  forceRecompute = false
): TelemetryMetrics {
  if (
    !forceRecompute &&
    cachedMetrics &&
    now - lastComputedAt < 1000 &&
    events.length === lastEventCount
  ) {
    return cachedMetrics
  }

  lastEventCount = events.length

  let successfulSends = 0
  let failedSends = 0
  let timeoutCount = 0
  let retryCount = 0
  let webviewCrashCount = 0
  let executeJsErrorCount = 0
  let staleWebviewCount = 0
  let cacheHits = 0
  let cacheMisses = 0
  let fallbackUsed = 0
  let selectorEvents = 0
  let uploadStarts = 0
  let uploadSuccesses = 0
  let recoveryTriggered = 0
  let recoverySuccess = 0
  let selectorRecoverySuccess = 0
  let selectorRecoveryAttempts = 0

  const providerDurations: Record<string, number[]> = {}

  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    const t = e.type

    switch (t) {
      case 'SEND_SUCCESS':
        successfulSends++
        break
      case 'IMAGE_UPLOAD_SUCCESS':
        successfulSends++
        uploadSuccesses++
        break
      case 'SEND_FAILED':
      case 'PIPELINE_ERROR':
        failedSends++
        break
      case 'SEND_TIMEOUT':
      case 'PIPELINE_TIMEOUT':
        timeoutCount++
        break
      case 'WEBVIEW_CRASH':
        webviewCrashCount++
        break
      case 'IMAGE_UPLOAD_START':
        uploadStarts++
        break
      case 'RECOVERY_TRIGGERED':
        recoveryTriggered++
        break
      case 'RECOVERY_SUCCESS':
        recoverySuccess++
        break
      case 'SELECTOR_SELF_HEALED':
        selectorRecoverySuccess++
        selectorRecoveryAttempts++
        selectorEvents++
        break
      case 'SELECTOR_RECOVERY_FAILED':
        selectorRecoveryAttempts++
        break
      case 'SELECTOR_FALLBACK_USED':
        fallbackUsed++
        selectorEvents++
        break
      case 'SELECTOR_PRIMARY_FAILED':
      case 'FALLBACK_APPLIED':
        selectorEvents++
        break
    }

    if (e.retryCount) retryCount += e.retryCount
    if (e.cacheStatus === 'hit') cacheHits++
    else if (e.cacheStatus === 'miss') cacheMisses++
    if (t === 'PIPELINE_ERROR' && e.pipelineStage === 'script_execution') executeJsErrorCount++
    if (e.message?.includes('webview_destroyed')) staleWebviewCount++

    if (e.duration && e.provider) {
      if (!providerDurations[e.provider]) providerDurations[e.provider] = []
      providerDurations[e.provider].push(e.duration)
    }
  }

  const cacheTotal = cacheHits + cacheMisses
  const cacheHitRatio = cacheTotal > 0 ? cacheHits / cacheTotal : 0
  const fallbackUsageRatio = selectorEvents > 0 ? fallbackUsed / selectorEvents : 0
  const uploadSuccessRatio = uploadStarts > 0 ? uploadSuccesses / uploadStarts : 0
  const recoverySuccessRatio = recoveryTriggered > 0 ? recoverySuccess / recoveryTriggered : 0
  const selectorRecoveryRate =
    selectorRecoveryAttempts > 0 ? selectorRecoverySuccess / selectorRecoveryAttempts : 0

  const providerLatency: Record<string, number> = {}
  for (const [provider, durations] of Object.entries(providerDurations)) {
    let sum = 0
    for (let j = 0; j < durations.length; j++) sum += durations[j]
    providerLatency[provider] = Math.round((sum / durations.length) * 100) / 100
  }

  const totalSendEvents = successfulSends + failedSends
  const failedSendRatio = totalSendEvents > 0 ? failedSends / totalSendEvents : 0

  cachedMetrics = {
    averageSendDuration: averageSendTime,
    providerLatency,
    selectorRecoveryRate: Math.round(selectorRecoveryRate * 100) / 100,
    failedSendRatio: Math.round(failedSendRatio * 100) / 100,
    retryCount,
    timeoutCount,
    cacheHitRatio: Math.round(cacheHitRatio * 100) / 100,
    fallbackUsageRatio: Math.round(fallbackUsageRatio * 100) / 100,
    uploadSuccessRatio: Math.round(uploadSuccessRatio * 100) / 100,
    webviewCrashCount,
    recoverySuccessRatio: Math.round(recoverySuccessRatio * 100) / 100,
    totalSends,
    successfulSends,
    failedSends,
    executeJsErrorCount,
    staleWebviewCount
  }

  lastComputedAt = now
  return cachedMetrics
}

export function resetMetricsCache() {
  cachedMetrics = null
  lastComputedAt = 0
  lastEventCount = 0
}

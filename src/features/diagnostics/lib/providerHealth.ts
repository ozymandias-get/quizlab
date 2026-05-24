import type {
  ProviderHealthState,
  ProviderHealthSignal,
  DiagnosticsEvent,
  ProviderHealthStatus
} from '../model/types'
import {
  HEALTH_SIGNAL_TTL_MS,
  HEALTH_DEGRADED_THRESHOLD,
  HEALTH_SLOW_THRESHOLD_MS
} from '../model/types'

const HEALTH_STATUS_LABELS: Record<ProviderHealthStatus, string> = {
  HEALTHY: 'Sağlıklı',
  DEGRADED: 'Bozulmuş',
  UNHEALTHY: 'Sağlıksız',
  SLOW: 'Yavaş',
  SELECTOR_BROKEN: 'Seçici Bozuk',
  LOGIN_REQUIRED: 'Giriş Gerekli',
  RATE_LIMITED: 'Hız Sınırlı',
  WEBVIEW_UNRESPONSIVE: 'Webview Yanıtsız',
  UNKNOWN: 'Bilinmiyor'
}

export function getHealthStatusLabel(status: ProviderHealthStatus): string {
  return HEALTH_STATUS_LABELS[status]
}

export function getHealthStatusColor(status: ProviderHealthStatus): string {
  switch (status) {
    case 'HEALTHY':
      return 'text-green-400'
    case 'DEGRADED':
      return 'text-yellow-400'
    case 'SLOW':
      return 'text-orange-400'
    case 'SELECTOR_BROKEN':
      return 'text-red-400'
    case 'LOGIN_REQUIRED':
      return 'text-blue-400'
    case 'RATE_LIMITED':
      return 'text-purple-400'
    case 'WEBVIEW_UNRESPONSIVE':
      return 'text-red-500'
    default:
      return 'text-gray-400'
  }
}

function createHealthSignal(
  type: ProviderHealthSignal['type'],
  provider: string,
  weight = 1
): ProviderHealthSignal {
  return {
    type,
    timestamp: Date.now(),
    provider,
    weight
  }
}

function pruneStaleSignals(signals: ProviderHealthSignal[], now: number): ProviderHealthSignal[] {
  return signals.filter((s) => now - s.timestamp < HEALTH_SIGNAL_TTL_MS)
}

function computeHealthScore(signals: ProviderHealthSignal[]): number {
  if (signals.length === 0) return 100

  let score = 100
  for (const signal of signals) {
    const w = signal.weight ?? 1
    switch (signal.type) {
      case 'timeout':
        score -= 15 * w
        break
      case 'failed_send':
        score -= 10 * w
        break
      case 'send_latency':
        score -= 5 * w
        break
      case 'selector_recovery':
        score -= 8 * w
        break
      case 'execute_js_error':
        score -= 12 * w
        break
      case 'stale_webview':
        score -= 20 * w
        break
      case 'readiness_failure':
        score -= 10 * w
        break
      case 'upload_failure':
        score -= 15 * w
        break
    }
  }

  return Math.max(0, Math.min(100, score))
}

function determineStatus(
  score: number,
  signals: ProviderHealthSignal[],
  recentEvents: DiagnosticsEvent[]
): { status: ProviderHealthStatus; reason?: string } {
  const now = Date.now()
  const recentWindow = recentEvents.filter((e) => now - e.timestamp < 30_000)

  const loginRequiredSignals = signals.filter((s) => s.type === 'readiness_failure').length
  if (loginRequiredSignals >= HEALTH_DEGRADED_THRESHOLD) {
    return { status: 'LOGIN_REQUIRED', reason: 'Repeated readiness failures' }
  }

  const webviewCrashes = recentWindow.filter((e) => e.type === 'WEBVIEW_CRASH').length
  if (webviewCrashes > 0) {
    return { status: 'WEBVIEW_UNRESPONSIVE', reason: 'Webview crash detected' }
  }

  const timeouts = signals.filter((s) => s.type === 'timeout').length
  if (timeouts >= HEALTH_DEGRADED_THRESHOLD) {
    return { status: 'RATE_LIMITED', reason: 'Multiple timeouts detected' }
  }

  const selectorFailures = signals.filter((s) => s.type === 'selector_recovery').length
  if (selectorFailures >= HEALTH_DEGRADED_THRESHOLD) {
    return { status: 'SELECTOR_BROKEN', reason: 'Selector recovery failing repeatedly' }
  }

  const avgLatency = signals
    .filter((s) => s.type === 'send_latency')
    .reduce((sum, s) => sum + (s.weight ?? 1), 0)
  if (
    avgLatency > HEALTH_SLOW_THRESHOLD_MS &&
    signals.filter((s) => s.type === 'send_latency').length > 0
  ) {
    return { status: 'SLOW', reason: 'High average latency' }
  }

  if (score < 50) {
    return { status: 'DEGRADED', reason: 'Health score below threshold' }
  }

  if (score < 70) {
    return { status: 'SLOW', reason: 'Health score degraded' }
  }

  return { status: 'HEALTHY' }
}

export function updateProviderHealth(
  currentState: ProviderHealthState | undefined,
  signal: ProviderHealthSignal,
  recentEvents: DiagnosticsEvent[]
): ProviderHealthState {
  const now = Date.now()
  const signals = currentState
    ? pruneStaleSignals([...currentState.signals, signal], now)
    : [signal]

  const score = computeHealthScore(signals)
  const { status, reason } = determineStatus(score, signals, recentEvents)

  return {
    status,
    score,
    signals,
    lastUpdated: now,
    lastSignal: now,
    signalCount: signals.length,
    consecutiveErrors: signals.filter((s) => s.type === 'failed_send' || s.type === 'timeout')
      .length,
    averageLatency:
      signals.filter((s) => s.type === 'send_latency').length > 0
        ? signals
            .filter((s) => s.type === 'send_latency')
            .reduce((sum, s) => sum + (s.weight ?? 1), 0) /
          signals.filter((s) => s.type === 'send_latency').length
        : 0,
    degradedReason: reason
  }
}

export function computeProviderHealthFromEvents(
  provider: string,
  events: DiagnosticsEvent[]
): ProviderHealthState {
  const now = Date.now()
  const signals: ProviderHealthSignal[] = []

  for (const event of events) {
    if (event.provider !== provider) continue
    if (now - event.timestamp > HEALTH_SIGNAL_TTL_MS) continue

    switch (event.type) {
      case 'SEND_TIMEOUT':
      case 'PIPELINE_TIMEOUT':
        signals.push(createHealthSignal('timeout', provider, 1))
        break
      case 'SEND_FAILED':
      case 'PIPELINE_ERROR':
        signals.push(createHealthSignal('failed_send', provider, 1))
        break
      case 'SELECTOR_RECOVERY_FAILED':
        signals.push(createHealthSignal('selector_recovery', provider, 1))
        break
      case 'SELECTOR_SELF_HEALED':
        signals.push(createHealthSignal('selector_recovery', provider, 0.5))
        break
      case 'WEBVIEW_CRASH':
        signals.push(createHealthSignal('stale_webview', provider, 2))
        break
      case 'IMAGE_UPLOAD_START':
        break
      case 'PASTE_FAILED':
        signals.push(createHealthSignal('upload_failure', provider, 1))
        break
      case 'CLIPBOARD_FAILED':
        signals.push(createHealthSignal('upload_failure', provider, 0.5))
        break
    }

    if (event.duration && event.duration > HEALTH_SLOW_THRESHOLD_MS) {
      signals.push(createHealthSignal('send_latency', provider, event.duration / 1000))
    }
  }

  const pruned = pruneStaleSignals(signals, now)
  const score = computeHealthScore(pruned)
  const { status, reason } = determineStatus(score, pruned, events)

  return {
    status,
    score,
    signals: pruned,
    lastUpdated: now,
    lastSignal: now,
    signalCount: pruned.length,
    consecutiveErrors: pruned.filter((s) => s.type === 'failed_send' || s.type === 'timeout')
      .length,
    averageLatency:
      pruned.filter((s) => s.type === 'send_latency').length > 0
        ? pruned
            .filter((s) => s.type === 'send_latency')
            .reduce((sum, s) => sum + (s.weight ?? 1), 0) /
          pruned.filter((s) => s.type === 'send_latency').length
        : 0,
    degradedReason: reason
  }
}

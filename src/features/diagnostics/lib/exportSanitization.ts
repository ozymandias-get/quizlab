import type { DiagnosticsEvent, DiagnosticsSnapshot } from '../model/types'

const SENSITIVE_PATTERNS = [
  /data:image\/[^;]+;base64,[\w+/=]+/gi,
  /cookie[^;]*/gi,
  /token["\s:=]+\S+/gi,
  /api[_-]?key["\s:=]+\S+/gi,
  /sk-[\w]+/gi,
  /password["\s:=]+\S+/gi,
  /secret["\s:=]+\S+/gi,
  /file:\/\/[^\s"']+/gi,
  /<html[\s\S]*?<\/html>/gi,
  /<body[\s\S]*?<\/body>/gi,
  /<!DOCTYPE[\s\S]*?>/gi,
  /authorization["\s:=]+\S+/gi,
  /bearer\s+\S+/gi,
  /session[_-]?id["\s:=]+\S+/gi,
  /access[_-]?token["\s:=]+\S+/gi,
  /refresh[_-]?token["\s:=]+\S+/gi,
  /local[_-]?storage[\s\S]{0,200}/gi,
  /__electron[_-]?preload[\s\S]{0,200}/gi
]

const SENSITIVE_EVENT_FIELDS = new Set(['message', 'selectorUsed', 'fallbackStrategy'])

export function sanitizeString(value: string): string {
  let result = value
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  return result
}

function sanitizeEvent(event: DiagnosticsEvent): DiagnosticsEvent {
  const sanitized = { ...event }

  for (const field of SENSITIVE_EVENT_FIELDS) {
    const key = field as keyof DiagnosticsEvent
    const value = sanitized[key]
    if (typeof value === 'string') {
      ;(sanitized as any)[key] = sanitizeString(value)
    }
  }

  return sanitized
}

export function sanitizeEvents(events: DiagnosticsEvent[]): DiagnosticsEvent[] {
  return events.map(sanitizeEvent)
}

export function sanitizeSnapshot(snapshot: DiagnosticsSnapshot): DiagnosticsSnapshot {
  return {
    ...snapshot,
    lastError: snapshot.lastError ? sanitizeString(snapshot.lastError) : null,
    events: sanitizeEvents(snapshot.events),
    groupedErrors: snapshot.groupedErrors.map((ge) => ({
      ...ge,
      message: sanitizeString(ge.message)
    }))
  }
}

export function createSafeExport(snapshot: DiagnosticsSnapshot): Record<string, unknown> {
  const safe = sanitizeSnapshot(snapshot)

  return {
    appVersion: safe.appVersion,
    platform: safe.platform,
    timestamp: safe.timestamp,
    providerState: safe.providerState,
    queueState: safe.queueState,
    timingSummary: safe.timingSummary,
    metrics: safe.metrics,
    lastError: safe.lastError,
    groupedErrors: safe.groupedErrors,
    events: safe.events,
    settings: safe.settings,
    webviewState: safe.webviewState
  }
}

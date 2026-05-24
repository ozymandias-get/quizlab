import type { DiagnosticsEvent, GroupedError } from '../model/types'
import { ERROR_GROUP_WINDOW_MS } from '../model/types'

const ERROR_GROUPING_TYPES = new Set<DiagnosticsEvent['type']>([
  'PIPELINE_ERROR',
  'SEND_FAILED',
  'SEND_TIMEOUT',
  'PIPELINE_TIMEOUT',
  'SELECTOR_RECOVERY_FAILED',
  'PASTE_FAILED',
  'CLIPBOARD_FAILED',
  'WEBVIEW_CRASH',
  'FALLBACK_REJECTED'
])

function errorGroupKey(event: DiagnosticsEvent): string {
  return `${event.type}::${event.message ?? ''}::${event.provider}`
}

export function groupErrors(events: DiagnosticsEvent[]): GroupedError[] {
  const groups = new Map<string, GroupedError[]>()

  for (const event of events) {
    if (!ERROR_GROUPING_TYPES.has(event.type)) continue

    const key = errorGroupKey(event)
    if (!groups.has(key)) {
      groups.set(key, [])
    }

    const existingGroups = groups.get(key)!
    const lastGroup = existingGroups[existingGroups.length - 1]

    if (lastGroup && event.timestamp - lastGroup.lastSeen < ERROR_GROUP_WINDOW_MS) {
      lastGroup.count++
      lastGroup.lastSeen = event.timestamp
      if (event.severity === 'error') {
        lastGroup.severity = 'error'
      }
    } else {
      existingGroups.push({
        type: event.type,
        message: event.message ?? '',
        provider: event.provider,
        providers: [event.provider],
        count: 1,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        severity: event.severity,
        pipelineStage: event.pipelineStage,
        pipelineStages: [event.pipelineStage]
      })
    }
  }

  const allGroups: GroupedError[] = []
  for (const groupList of groups.values()) {
    allGroups.push(...groupList)
  }

  return allGroups.sort((a, b) => b.lastSeen - a.lastSeen)
}

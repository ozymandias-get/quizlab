import type { ApiChatMessage } from '@shared-core/types'

import i18next from 'i18next'

function getAppLocale(): string {
  const lng = i18next.language || 'en'
  if (lng.startsWith('tr')) return 'tr-TR'
  if (lng.startsWith('en')) return 'en-US'
  return lng
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getCachedFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(options)
  let fmt = formatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options)
    formatterCache.set(key, fmt)
  }
  return fmt
}

export function formatTime(ts: number, localeOverride?: string): string {
  const locale = localeOverride || getAppLocale()
  return getCachedFormatter(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(ts)
}

export function formatDate(
  ts: number,
  todayLabel = 'Today',
  yesterdayLabel = 'Yesterday',
  localeOverride?: string
): string {
  const d = new Date(ts)
  const now = new Date()

  if (d.toDateString() === now.toDateString()) return todayLabel

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return yesterdayLabel

  const locale = localeOverride || getAppLocale()
  return d.getFullYear() === now.getFullYear()
    ? getCachedFormatter(locale, { month: 'short', day: 'numeric' }).format(d)
    : getCachedFormatter(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

type MessageGroupEntry =
  | { kind: 'date'; timestamp: number }
  | { kind: 'messages'; messages: ApiChatMessage[] }

export type MessageGroupsResult = {
  groups: MessageGroupEntry[]
  lastAssistantId: string | null
}

export function groupMessages(messages: ApiChatMessage[]): MessageGroupsResult {
  const groups: MessageGroupEntry[] = []
  let lastDate = ''
  let currentGroup: ApiChatMessage[] = []
  // Reusable Date to avoid allocating N Date objects per render
  const dateCursor = new Date()

  for (const msg of messages) {
    dateCursor.setTime(msg.timestamp)
    const msgDate = dateCursor.toDateString()

    if (msgDate !== lastDate) {
      if (currentGroup.length > 0) {
        groups.push({ kind: 'messages', messages: currentGroup })
        currentGroup = []
      }
      // Use the first message of the new day's timestamp as the date label.
      groups.push({ kind: 'date', timestamp: msg.timestamp })
      lastDate = msgDate
    }

    const last = currentGroup[currentGroup.length - 1]
    if (last && last.role === msg.role) {
      currentGroup.push(msg)
    } else {
      if (currentGroup.length > 0) {
        groups.push({ kind: 'messages', messages: currentGroup })
        currentGroup = []
      }
      currentGroup.push(msg)
    }
  }

  if (currentGroup.length > 0) {
    groups.push({ kind: 'messages', messages: currentGroup })
  }

  // Single pass to find the last assistant message id, used by MessageList
  // to drive the "regenerate" affordance only on the most recent assistant
  // reply. The previous implementation recomputed this in the JSX of every
  // row of every render.
  let lastAssistantId: string | null = null
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantId = messages[i].id
      break
    }
  }

  return { groups, lastAssistantId }
}

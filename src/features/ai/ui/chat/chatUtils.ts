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
  { kind: 'date'; timestamp: number } | { kind: 'messages'; messages: ApiChatMessage[] }

export type { MessageGroupEntry }

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

export interface MessageGroupsCache {
  messages: ApiChatMessage[]
  result: MessageGroupsResult
}

/**
 * Grouping for the streaming hot path.
 *
 * A token update replaces the *last* message object (same id, role and
 * timestamp, new content). Group boundaries depend only on date and role, so
 * the previous groups are still correct except for that one object reference.
 * Reusing them avoids re-running `toDateString()` and the role walk over the
 * whole history on every chunk; anything else (append, delete, edit that changes
 * role or time) falls back to the full pass.
 *
 * The prefix scan below is deliberate. An edit or delete can change any earlier
 * element, so trusting "only the tail moves" would surface stale groups and
 * stale message objects. The scan is pointer comparison only — no allocation,
 * no date formatting — which is the expensive part of the full walk.
 */
export function groupMessagesIncremental(
  previous: MessageGroupsCache | null,
  messages: ApiChatMessage[]
): MessageGroupsResult {
  if (previous && previous.messages === messages) return previous.result
  if (!previous || messages.length === 0) return groupMessages(messages)

  const previousMessages = previous.messages
  if (previousMessages.length !== messages.length) return groupMessages(messages)

  const last = messages[messages.length - 1]
  const previousLast = previousMessages[previousMessages.length - 1]
  if (
    last.id !== previousLast.id ||
    last.role !== previousLast.role ||
    last.timestamp !== previousLast.timestamp
  ) {
    return groupMessages(messages)
  }
  for (let i = 0; i < messages.length - 1; i += 1) {
    if (messages[i] !== previousMessages[i]) return groupMessages(messages)
  }

  // Shallow copy: only the group holding the changed message is rebuilt.
  const groups = [...previous.result.groups]
  let replaced = false
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i]
    if (group.kind !== 'messages') continue
    if (group.messages[group.messages.length - 1] !== previousLast) continue
    const groupMessagesCopy = [...group.messages]
    groupMessagesCopy[groupMessagesCopy.length - 1] = last
    groups[i] = { kind: 'messages', messages: groupMessagesCopy }
    replaced = true
    break
  }
  // The previous result did not actually contain the old tail: recompute.
  if (!replaced) return groupMessages(messages)

  const lastAssistantId = last.role === 'assistant' ? last.id : previous.result.lastAssistantId

  return { groups, lastAssistantId }
}

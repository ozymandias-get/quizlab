import type { ApiChatMessage } from '@shared-core/types'

// Cached Intl formatters (created once at module level)
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric'
})

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})

export function formatTime(ts: number): string {
  return timeFormatter.format(ts)
}

export function formatDate(ts: number, todayLabel = 'Today', yesterdayLabel = 'Yesterday'): string {
  const d = new Date(ts)
  const now = new Date()

  if (d.toDateString() === now.toDateString()) return todayLabel

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return yesterdayLabel

  return d.getFullYear() === now.getFullYear()
    ? shortDateFormatter.format(d)
    : fullDateFormatter.format(d)
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

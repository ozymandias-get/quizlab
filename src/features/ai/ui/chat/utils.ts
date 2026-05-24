import type { ApiChatMessage } from '@shared-core/types'

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export function formatDate(ts: number, todayLabel = 'Today', yesterdayLabel = 'Yesterday'): string {
  const d = new Date(ts)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === now.toDateString()) return todayLabel
  if (d.toDateString() === yesterday.toDateString()) return yesterdayLabel

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

export type MessageGroup = ApiChatMessage[] | 'date'

export function groupMessages(messages: ApiChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  let lastDate = ''
  let currentGroup: ApiChatMessage[] = []

  for (const msg of messages) {
    const msgDate = new Date(msg.timestamp).toDateString()

    if (msgDate !== lastDate) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup)
        currentGroup = []
      }
      groups.push('date')
      lastDate = msgDate
    }

    const last = currentGroup[currentGroup.length - 1]
    if (last && last.role === msg.role) {
      currentGroup.push(msg)
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup)
        currentGroup = []
      }
      currentGroup.push(msg)
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

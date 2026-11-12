/**
 * Tests for src/features/ai/ui/chat/utils.ts — formatTime, formatDate,
 * and groupMessages. Used to render timestamps and date separators in
 * the chat message list.
 */
import type { ApiChatMessage } from '@shared-core/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatDate, formatTime, groupMessages } from '../../../../../features/ai/ui/chat/chatUtils'

function makeMessage(
  timestamp: number,
  role: 'user' | 'assistant' = 'user',
  content = 'hello'
): ApiChatMessage {
  return { id: `m-${timestamp}-${role}`, role, content, timestamp }
}

describe('formatTime', () => {
  it.each([
    ['a two-digit time', new Date(2026, 5, 2, 14, 30), '14:30'],
    ['a single-digit hour and minute', new Date(2026, 5, 2, 9, 5), '09:05'],
    ['midnight', new Date(2026, 5, 2, 0, 0), '00:00']
  ])('formats %s as HH:MM', (_case, date, expected) => {
    expect(formatTime(date.getTime())).toBe(expected)
  })
})

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T15:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Today" for today\'s date (default label)', () => {
    const today = Date.now()
    expect(formatDate(today)).toBe('Today')
  })

  it('returns "Yesterday" for yesterday\'s date (default label)', () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000
    expect(formatDate(yesterday)).toBe('Yesterday')
  })

  it('returns "Today" when explicitly passed (custom label)', () => {
    const today = Date.now()
    expect(formatDate(today, 'Bugün')).toBe('Bugün')
  })

  it('returns "Yesterday" with custom label', () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000
    expect(formatDate(yesterday, 'Bugün', 'Dün')).toBe('Dün')
  })

  it('returns a formatted date for older dates', () => {
    const result = formatDate(new Date(2026, 0, 15).getTime(), 'Today', 'Yesterday', 'en-US')
    expect(result).toBe('Jan 15')
  })

  it('includes the year when the date is in a different year', () => {
    const result = formatDate(new Date(2025, 5, 2).getTime(), 'Today', 'Yesterday', 'en-US')
    expect(result).toBe('Jun 2, 2025')
  })
})

describe('groupMessages', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T15:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty groups for no messages', () => {
    const result = groupMessages([])
    expect(result.groups).toEqual([])
    expect(result.lastAssistantId).toBeNull()
  })

  it('returns [date, group] for a single message', () => {
    const now = Date.now()
    const messages = [makeMessage(now)]
    const result = groupMessages(messages)
    expect(result.groups.length).toBe(2)
    expect(result.groups[0]).toMatchObject({ kind: 'date' })
    expect(result.groups[1]).toMatchObject({ kind: 'messages', messages })
    // A single user message → no assistant yet
    expect(result.lastAssistantId).toBeNull()
  })

  it('groups consecutive same-role messages into one group', () => {
    const now = Date.now()
    const messages = [
      makeMessage(now, 'user', 'm1'),
      makeMessage(now + 1000, 'user', 'm2'),
      makeMessage(now + 2000, 'user', 'm3')
    ]
    const result = groupMessages(messages)
    // [date, [m1, m2, m3]]
    expect(result.groups.length).toBe(2)
    expect(result.groups[0]).toMatchObject({ kind: 'date' })
    expect(result.groups[1]).toMatchObject({ kind: 'messages', messages })
  })

  it('separates different-role messages into different groups', () => {
    const now = Date.now()
    const messages = [
      makeMessage(now, 'user', 'm1'),
      makeMessage(now + 1000, 'assistant', 'm2'),
      makeMessage(now + 2000, 'user', 'm3')
    ]
    const result = groupMessages(messages)
    // [date, [m1], [m2], [m3]]
    expect(result.groups.length).toBe(4)
    expect(result.groups[0]).toMatchObject({ kind: 'date' })
    expect(result.groups[1]).toMatchObject({ kind: 'messages', messages: [messages[0]] })
    expect(result.groups[2]).toMatchObject({ kind: 'messages', messages: [messages[1]] })
    expect(result.groups[3]).toMatchObject({ kind: 'messages', messages: [messages[2]] })
    // The most recent assistant is m2
    expect(result.lastAssistantId).toBe(messages[1].id)
  })

  it('inserts a "date" marker between messages from different days', () => {
    const now = Date.now()
    const yesterday = now - 24 * 60 * 60 * 1000
    const messages = [makeMessage(yesterday, 'user', 'm1'), makeMessage(now, 'user', 'm2')]
    const result = groupMessages(messages)
    // [date, [m1], date, [m2]]
    expect(result.groups.length).toBe(4)
    expect(result.groups[0]).toMatchObject({ kind: 'date' })
    expect(result.groups[1]).toMatchObject({ kind: 'messages', messages: [messages[0]] })
    expect(result.groups[2]).toMatchObject({ kind: 'date' })
    expect(result.groups[3]).toMatchObject({ kind: 'messages', messages: [messages[1]] })
  })

  it('coalesces a same-day same-role run after a different day', () => {
    const day1 = new Date('2026-06-01T10:00:00').getTime()
    const day2Morning = new Date('2026-06-02T08:00:00').getTime()
    const day2Later = new Date('2026-06-02T20:00:00').getTime()
    const messages = [
      makeMessage(day1, 'user', 'm1'),
      makeMessage(day2Morning, 'user', 'm2'),
      makeMessage(day2Later, 'user', 'm3')
    ]
    const result = groupMessages(messages)
    // [date, [m1], date, [m2, m3]]
    expect(result.groups.length).toBe(4)
    expect(result.groups[0]).toMatchObject({ kind: 'date' })
    expect(result.groups[1]).toMatchObject({ kind: 'messages', messages: [messages[0]] })
    expect(result.groups[2]).toMatchObject({ kind: 'date' })
    const day2Group = result.groups[3]
    expect(day2Group).toMatchObject({ kind: 'messages' })
    if (day2Group.kind === 'messages') {
      expect(day2Group.messages.length).toBe(2)
    }
  })

  it('handles a single message with different role', () => {
    const now = Date.now()
    const messages = [makeMessage(now, 'assistant')]
    const result = groupMessages(messages)
    expect(result.groups.length).toBe(2)
    expect(result.groups[0]).toMatchObject({ kind: 'date' })
    expect(result.groups[1]).toMatchObject({ kind: 'messages', messages })
    expect(result.lastAssistantId).toBe(messages[0].id)
  })
})

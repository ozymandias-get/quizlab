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
  // Local-time dependent, so the contract is the zero-padded HH:MM shape —
  // including the midnight case, which lands on 00:00 or the day-before 23:59
  // depending on the runner's timezone.
  it.each([
    ['a two-digit time', '2026-06-02T14:30:00'],
    ['a single-digit hour and minute', '2026-06-02T09:05:00'],
    ['midnight', '2026-06-02T00:00:00']
  ])('formats %s as HH:MM', (_case, iso) => {
    expect(formatTime(new Date(iso).getTime())).toMatch(/^\d{2}:\d{2}$/)
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
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000
    const result = formatDate(fiveDaysAgo)
    // Should NOT be Today or Yesterday
    expect(result).not.toBe('Today')
    expect(result).not.toBe('Yesterday')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes the year when the date is in a different year', () => {
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
    const result = formatDate(oneYearAgo)
    // Should contain a 4-digit year
    expect(result).toMatch(/\d{4}/)
  })

  it('does not include the year for the current year', () => {
    // The formatted branch for older dates in the same calendar year
    // should NOT include a 4-digit year (only "Mon DD" or similar).
    const thisYearDate = new Date('2026-01-15').getTime()
    const result = formatDate(thisYearDate)
    expect(result).not.toMatch(/\b20\d{2}\b/)
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

  it('records the last assistant id, even when followed by a user message', () => {
    const now = Date.now()
    const messages = [
      makeMessage(now, 'user', 'u1'),
      makeMessage(now + 1000, 'assistant', 'a1'),
      makeMessage(now + 2000, 'user', 'u2')
    ]
    const result = groupMessages(messages)
    // The last assistant in the list is a1 (u2 comes after but is user).
    expect(result.lastAssistantId).toBe(messages[1].id)
  })
})

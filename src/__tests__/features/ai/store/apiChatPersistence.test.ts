/**
 * Tests for apiChatPersistence — the persistence layer for AI Chat sessions.
 *
 * This handles localStorage read/write with debounced saving.
 *
 * @see @features/ai/store/apiChatPersistence
 */

import {
  loadSessionsFromStorage,
  LOCAL_STORAGE_KEY,
  scheduleSaveSessions
} from '@features/ai/store/apiChatPersistence'

import type { ApiChatMessage } from '@shared-core/types'

import type { ChatSession } from '@features/ai/store/apiChatSessionUtils'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function message(id: string, timestamp: number): ApiChatMessage {
  return { id, role: 'user', content: id, timestamp } as unknown as ApiChatMessage
}

function session(id: string, messages: ApiChatMessage[], updatedAt: number): ChatSession {
  return {
    id,
    title: id,
    messages,
    createdAt: 0,
    updatedAt
  } as unknown as ChatSession
}

describe('loadSessionsFromStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when localStorage is empty', () => {
    const result = loadSessionsFromStorage()
    expect(result).toEqual([])
  })

  it('parses valid JSON from localStorage', () => {
    const stored = [{ id: 's1', title: 'Session 1', messages: [], createdAt: 0, updatedAt: 100 }]
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stored))

    const result = loadSessionsFromStorage()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s1')
  })

  it('handles corrupted JSON gracefully', () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, '{not valid json')
    expect(() => loadSessionsFromStorage()).not.toThrow()
    expect(loadSessionsFromStorage()).toEqual([])
  })
})

describe('saveSessionsToStorage merge', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a cleared transcript cleared', () => {
    // The merge unions messages by id so two tabs cannot lose each other's
    // appended messages. A clear is not an append: the app marks the clear
    // explicitly, and the union must not put the messages back.
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([session('s1', [message('m1', 1), message('m2', 2)], 100)])
    )

    scheduleSaveSessions([session('s1', [], 200)], {
      messageIdsBySession: { s1: ['m1', 'm2'] },
      clearedSessions: { s1: 200 }
    })
    vi.advanceTimersByTime(1000)

    expect(loadSessionsFromStorage()[0].messages).toEqual([])
  })

  it('does not let a stale empty snapshot wipe messages added by another window', () => {
    // Window A loaded the empty transcript first; window B appended m2 after
    // that. A's next save still carries the old, empty list. Emptiness is not
    // a clear, so B's message has to survive.
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([session('s1', [message('m2', 2)], 200)])
    )

    scheduleSaveSessions([session('s1', [], 100)])
    vi.advanceTimersByTime(1000)

    expect(loadSessionsFromStorage()[0].messages.map((m) => m.id)).toEqual(['m2'])
  })

  it('does not resurrect a session the user deleted', () => {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([session('s1', [message('m1', 1)], 100), session('s2', [], 100)])
    )

    scheduleSaveSessions([session('s1', [message('m1', 1)], 200)], {
      sessionIds: ['s2']
    })
    vi.advanceTimersByTime(1000)

    expect(loadSessionsFromStorage().map((s) => s.id)).toEqual(['s1'])
  })

  it('does not resurrect messages truncated by regenerate', () => {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([session('s1', [message('m1', 1), message('m2', 2)], 100)])
    )

    scheduleSaveSessions([session('s1', [message('m1', 1)], 200)], {
      messageIdsBySession: { s1: ['m2'] }
    })
    vi.advanceTimersByTime(1000)

    expect(loadSessionsFromStorage()[0].messages.map((m) => m.id)).toEqual(['m1'])
  })

  it('does not let a stale window resurrect a deleted message', () => {
    // Window A deletes m2. Window B still holds the old transcript and appends
    // m3 afterwards. B's save has no in-memory mark of A's deletion, so the
    // durable tombstone has to remove m2 while keeping the new m3.
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([session('s1', [message('m1', 1), message('m2', 2)], 100)])
    )

    scheduleSaveSessions([session('s1', [message('m1', 1)], 200)], {
      messageIdsBySession: { s1: ['m2'] }
    })
    vi.advanceTimersByTime(1000)

    scheduleSaveSessions([
      session('s1', [message('m1', 1), message('m2', 2), message('m3', 3)], 300)
    ])
    vi.advanceTimersByTime(1000)

    expect(loadSessionsFromStorage()[0].messages.map((m) => m.id)).toEqual(['m1', 'm3'])
  })

  it('does not let a stale window resurrect a deleted session', () => {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([session('s1', [], 100), session('s2', [message('m1', 1)], 100)])
    )

    scheduleSaveSessions([session('s1', [], 200)], { sessionIds: ['s2'] })
    vi.advanceTimersByTime(1000)

    // The other window has not refreshed yet and still saves both sessions.
    scheduleSaveSessions([session('s1', [], 300), session('s2', [message('m1', 1)], 300)])
    vi.advanceTimersByTime(1000)

    expect(loadSessionsFromStorage().map((s) => s.id)).toEqual(['s1'])
  })

  it('keeps a deletion in memory when the tombstone write fails and persists it on retry', () => {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([session('s1', [], 100), session('s2', [message('m1', 1)], 100)])
    )

    const originalSetItem = Storage.prototype.setItem
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key === 'quizlab_api_chat_deletions_v1') throw new Error('quota')
      return originalSetItem.call(this, key, value)
    })

    try {
      scheduleSaveSessions([session('s1', [], 200)], { sessionIds: ['s2'] })
      vi.advanceTimersByTime(1000)
      expect(loadSessionsFromStorage().map((s) => s.id)).toEqual(['s1'])
    } finally {
      write.mockRestore()
    }

    // The same deletion must survive a stale save from a window that still
    // has s2, even though the ledger only became writable after the first save.
    scheduleSaveSessions([session('s1', [], 300), session('s2', [message('m1', 1)], 300)])
    vi.advanceTimersByTime(1000)

    expect(loadSessionsFromStorage().map((s) => s.id)).toEqual(['s1'])
  })

  it('keeps only the new session after clear-all', () => {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([session('s1', [], 100), session('s2', [], 100)])
    )

    scheduleSaveSessions([session('fresh', [], 200)], { sessionIds: ['s1', 's2'] })
    vi.advanceTimersByTime(1000)

    expect(loadSessionsFromStorage().map((s) => s.id)).toEqual(['fresh'])
  })

  it('still unions two tabs appending to the same session', () => {
    // The reason the union exists. Neither side of the fix may break it.
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([session('s1', [message('stored', 1)], 100)])
    )

    scheduleSaveSessions([session('s1', [message('incoming', 2)], 200)])
    vi.advanceTimersByTime(1000)

    expect(loadSessionsFromStorage()[0].messages.map((m) => m.id)).toEqual(['stored', 'incoming'])
  })
})

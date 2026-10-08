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

  it('handles malformed JSON gracefully', () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, 'not even close to json')
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
    // appended messages. A clear is not an append: the emptied copy is the
    // newer one, so the union would seed from the stored transcript and put
    // every message back — on screen it stayed empty (the query cache holds
    // `[]`) but the next save wrote them to disk and the clear was undone on
    // the next launch.
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([session('s1', [message('m1', 1), message('m2', 2)], 100)])
    )

    scheduleSaveSessions([session('s1', [], 200)])
    vi.advanceTimersByTime(1000)

    expect(loadSessionsFromStorage()[0].messages).toEqual([])
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

  it('keeps a session that was already empty empty', () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([session('s1', [], 100)]))

    scheduleSaveSessions([session('s1', [], 200)])
    vi.advanceTimersByTime(1000)

    expect(loadSessionsFromStorage()[0].messages).toEqual([])
  })
})

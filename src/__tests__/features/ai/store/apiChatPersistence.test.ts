/**
 * Tests for apiChatPersistence — the persistence layer for AI Chat sessions.
 *
 * This handles localStorage read/write with debounced saving.
 *
 * @see @features/ai/store/apiChatPersistence
 */

import { loadSessionsFromStorage, LOCAL_STORAGE_KEY } from '@features/ai/store/apiChatPersistence'

import { beforeEach, describe, expect, it } from 'vitest'

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

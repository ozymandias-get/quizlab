import {
  flushPendingSessions,
  loadSessionsFromStorageAsync,
  LOCAL_STORAGE_KEY,
  scheduleSaveSessions
} from '@features/ai/store/apiChatPersistence'
import type { ChatSession } from '@features/ai/store/apiChatSessionUtils'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => {
  const values = new Map<string, string>()
  return { values, quotaExceeded: false, failRemove: false, failMarker: false }
})

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (storage.failMarker && key.includes('storage_mode')) {
      throw new DOMException('quota', 'QuotaExceededError')
    }
    if (
      storage.quotaExceeded &&
      key === LOCAL_STORAGE_KEY &&
      !value.startsWith('{"__quizlab_storage_mode__"')
    ) {
      throw new DOMException('quota', 'QuotaExceededError')
    }
    storage.values.set(key, value)
  },
  removeItem: (key: string) => {
    if (storage.failRemove) throw new Error('storage removal blocked')
    storage.values.delete(key)
  },
  clear: () => storage.values.clear()
})

const indexedDb = vi.hoisted(() => ({
  update: vi.fn(),
  read: vi.fn(async () => null),
  notify: vi.fn(),
  subscribe: vi.fn(() => () => undefined)
}))

vi.mock('@features/ai/store/apiChatIndexedDb', () => ({
  updateSessionsInIndexedDb: indexedDb.update,
  readSessionsFromIndexedDb: indexedDb.read,
  notifyIndexedDbSessionsChanged: indexedDb.notify,
  subscribeToIndexedDbSessionChanges: indexedDb.subscribe
}))

const SESSION = {
  id: 's1',
  title: 's1',
  messages: [],
  createdAt: 0,
  updatedAt: 1
} as unknown as ChatSession

describe('flushing sessions on shutdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    storage.values.clear()
    storage.quotaExceeded = true
    storage.failRemove = false
    storage.failMarker = false
    indexedDb.update.mockReset()
    indexedDb.read.mockReset().mockResolvedValue(null)
  })

  it('waits for a save that a previous timer already started', async () => {
    let release!: (value: (typeof SESSION)[]) => void
    indexedDb.update.mockImplementation(
      () =>
        new Promise<(typeof SESSION)[]>((resolve) => {
          release = resolve
        })
    )

    scheduleSaveSessions([SESSION])
    await vi.advanceTimersByTimeAsync(300)
    expect(indexedDb.update).toHaveBeenCalledTimes(1)

    let settled = false
    const flush = flushPendingSessions().then((saved) => {
      settled = true
      return saved
    })

    await Promise.resolve()
    // The debounce slot is empty, but the IndexedDB write is still running.
    expect(settled).toBe(false)

    release([SESSION])
    await expect(flush).resolves.toBe(true)
  })

  it('keeps IndexedDB authoritative when the stale local key cannot be removed', async () => {
    const stale = {
      id: 'old',
      title: 'old',
      messages: [],
      createdAt: 0,
      updatedAt: 1
    } as unknown as ChatSession
    const fresh = {
      id: 'new',
      title: 'new',
      messages: [],
      createdAt: 0,
      updatedAt: 2
    } as unknown as ChatSession

    storage.values.set(LOCAL_STORAGE_KEY, JSON.stringify([stale]))
    storage.failRemove = true
    indexedDb.update.mockImplementation(async (merge: (stored: ChatSession[]) => ChatSession[]) =>
      merge([])
    )
    indexedDb.read.mockResolvedValue([fresh] as never)

    scheduleSaveSessions([fresh])
    await vi.advanceTimersByTimeAsync(300)
    await flushPendingSessions()

    expect(storage.values.get(LOCAL_STORAGE_KEY)).toContain('"old"')
    await expect(loadSessionsFromStorageAsync()).resolves.toEqual([fresh])
  })

  it('keeps IndexedDB authoritative when both the mode marker and the removal fail', async () => {
    const stale = {
      id: 'old-marker',
      title: 'old',
      messages: [],
      createdAt: 0,
      updatedAt: 1
    } as unknown as ChatSession
    const fresh = {
      id: 'new-marker',
      title: 'new',
      messages: [],
      createdAt: 0,
      updatedAt: 2
    } as unknown as ChatSession

    storage.values.set(LOCAL_STORAGE_KEY, JSON.stringify([stale]))
    storage.failRemove = true
    storage.failMarker = true
    indexedDb.update.mockImplementation(async (merge: (stored: ChatSession[]) => ChatSession[]) =>
      merge([])
    )
    indexedDb.read.mockResolvedValue([fresh] as never)

    scheduleSaveSessions([fresh])
    await vi.advanceTimersByTimeAsync(300)
    await flushPendingSessions()

    expect(storage.values.get(LOCAL_STORAGE_KEY)).toBe('{"__quizlab_storage_mode__":"indexeddb"}')
    await expect(loadSessionsFromStorageAsync()).resolves.toEqual([fresh])
  })

  it('follows the shared marker when another window switches back to local storage', async () => {
    indexedDb.update.mockImplementation(async (merge: (stored: ChatSession[]) => ChatSession[]) =>
      merge([])
    )

    scheduleSaveSessions([SESSION])
    await vi.advanceTimersByTimeAsync(300)
    await flushPendingSessions()
    expect(storage.values.has('quizlab_api_chat_storage_mode_v1')).toBe(true)

    // Another window could write locally and clear the shared marker.
    storage.values.delete('quizlab_api_chat_storage_mode_v1')
    storage.quotaExceeded = false
    indexedDb.update.mockClear()
    const local = {
      id: 'local',
      title: 'local',
      messages: [],
      createdAt: 0,
      updatedAt: 2
    } as unknown as ChatSession

    scheduleSaveSessions([local])
    await vi.advanceTimersByTimeAsync(300)
    await flushPendingSessions()

    expect(indexedDb.update).not.toHaveBeenCalled()
    expect(storage.values.get(LOCAL_STORAGE_KEY)).toContain('"local"')
  })

  it('reports a failed write instead of a clean shutdown', async () => {
    indexedDb.update.mockResolvedValue(null)

    scheduleSaveSessions([SESSION])
    vi.advanceTimersByTime(300)
    // The save has started (it awaits IndexedDB) but has not finished yet.
    await expect(flushPendingSessions()).resolves.toBe(false)
  })

  it('merges against the store inside the IndexedDB transaction', async () => {
    // The old write cleared the store and put this window's snapshot. That
    // snapshot predates a session another window wrote, so the transaction
    // callback has to receive that stored session and merge it, not replace it.
    const otherWindowSession = {
      id: 's2',
      title: 's2',
      messages: [],
      createdAt: 0,
      updatedAt: 2
    } as unknown as ChatSession
    let stored: ChatSession[] = [otherWindowSession]
    indexedDb.update.mockImplementation(async (merge: (stored: ChatSession[]) => ChatSession[]) => {
      stored = merge(stored)
      return stored
    })

    scheduleSaveSessions([SESSION])
    await vi.advanceTimersByTimeAsync(300)
    await flushPendingSessions()

    expect(stored.map((session) => session.id).sort()).toEqual(['s1', 's2'])
  })
})

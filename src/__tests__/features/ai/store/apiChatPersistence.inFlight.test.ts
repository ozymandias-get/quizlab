import { flushPendingSessions, scheduleSaveSessions } from '@features/ai/store/apiChatPersistence'
import type { ChatSession } from '@features/ai/store/apiChatSessionUtils'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => {
  const values = new Map<string, string>()
  return { values, quotaExceeded: false }
})

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (storage.quotaExceeded) {
      throw new DOMException('quota', 'QuotaExceededError')
    }
    storage.values.set(key, value)
  },
  removeItem: (key: string) => {
    storage.values.delete(key)
  },
  clear: () => storage.values.clear()
})

const indexedDb = vi.hoisted(() => ({
  write: vi.fn(),
  read: vi.fn(async () => null),
  notify: vi.fn(),
  subscribe: vi.fn(() => () => undefined)
}))

vi.mock('@features/ai/store/apiChatIndexedDb', () => ({
  writeSessionsToIndexedDb: indexedDb.write,
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
    indexedDb.write.mockReset()
  })

  it('waits for a save that a previous timer already started', async () => {
    let release!: (value: boolean) => void
    indexedDb.write.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        })
    )

    scheduleSaveSessions([SESSION])
    await vi.advanceTimersByTimeAsync(300)
    expect(indexedDb.write).toHaveBeenCalledTimes(1)

    let flushed = false
    const flush = flushPendingSessions().then(() => {
      flushed = true
    })

    await Promise.resolve()
    // The debounce slot is empty, but the IndexedDB write is still running.
    expect(flushed).toBe(false)

    release(true)
    await flush
    expect(flushed).toBe(true)
  })
})

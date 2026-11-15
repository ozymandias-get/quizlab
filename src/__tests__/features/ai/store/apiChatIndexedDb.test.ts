import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

interface FakeRequest {
  result?: unknown
  onupgradeneeded?: (() => void) | null
  onsuccess?: (() => void) | null
  onerror?: (() => void) | null
  onblocked?: (() => void) | null
}

function createOpenRequest(): FakeRequest {
  return {}
}

function fakeDatabase(rows: unknown[]) {
  return {
    close: vi.fn(),
    objectStoreNames: { contains: () => true },
    transaction: () => {
      const getAllRequest: {
        result: unknown[]
        onsuccess?: () => void
        onerror?: () => void
      } = { result: rows }
      return {
        onabort: null,
        objectStore: () => ({
          getAll: () => {
            queueMicrotask(() => getAllRequest.onsuccess?.())
            return getAllRequest
          }
        })
      }
    }
  }
}

async function loadReader() {
  const { readSessionsFromIndexedDb } = await import('@features/ai/store/apiChatIndexedDb')
  return readSessionsFromIndexedDb
}

describe('the IndexedDB session store', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retries a transient open failure instead of caching null forever', async () => {
    const requests: FakeRequest[] = []
    const open = vi.fn(() => {
      const request = createOpenRequest()
      requests.push(request)
      return request
    })
    vi.stubGlobal('indexedDB', { open })
    const read = await loadReader()

    const first = read()
    requests[0].onerror?.()
    await expect(first).resolves.toBeNull()

    const second = read()
    requests[1].result = fakeDatabase([{ id: 's1' }])
    requests[1].onsuccess?.()
    await expect(second).resolves.toEqual([{ id: 's1' }])
    expect(open).toHaveBeenCalledTimes(2)
  })

  it('does not leak a connection that succeeds after a blocked open', async () => {
    const requests: FakeRequest[] = []
    const open = vi.fn(() => {
      const request = createOpenRequest()
      requests.push(request)
      return request
    })
    vi.stubGlobal('indexedDB', { open })
    const read = await loadReader()

    const first = read()
    requests[0].onblocked?.()
    await expect(first).resolves.toBeNull()

    const lateDb = fakeDatabase([])
    requests[0].result = lateDb
    requests[0].onsuccess?.()
    expect(lateDb.close).toHaveBeenCalled()
  })
})

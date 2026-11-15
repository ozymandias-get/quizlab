/**
 * The IndexedDB overflow store of the AI chat sessions.
 *
 * `localStorage` is a good fit for a small, synchronous cache, but it has a
 * hard per-origin quota (about 5 MB) and a single long transcript can exhaust
 * it. When that happens the session list is written here instead, where the
 * quota is far larger; the next start reads it back when the localStorage key
 * is empty.
 *
 * The store is deliberately dumb: one object per session, replaced as a whole
 * on every write. The merge and deletion rules stay in `apiChatPersistence`.
 */

import type { ChatSession } from './apiChatSessionUtils'

const DB_NAME = 'quizlab-api-chat'
const DB_VERSION = 1
const STORE_NAME = 'sessions'
const CHANNEL_NAME = 'quizlab-api-chat-sessions'

let databasePromise: Promise<IDBDatabase | null> | null = null

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (databasePromise) return databasePromise

  let settled = false
  let resolvedNullSynchronously = false

  const promise = new Promise<IDBDatabase | null>((resolve) => {
    const fail = () => {
      if (settled) return
      settled = true
      // A failed open is not a permanent capability verdict: the next caller
      // must be able to retry after a transient block or error.
      databasePromise = null
      resolve(null)
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => {
        if (settled) {
          // A blocked request can still complete later. Its connection has no
          // owner after the failed promise; close it instead of leaking it.
          request.result.close()
          return
        }
        settled = true
        resolve(request.result)
      }
      request.onerror = fail
      request.onblocked = fail
    } catch {
      resolvedNullSynchronously = true
      fail()
    }
  })

  databasePromise = promise
  if (resolvedNullSynchronously) databasePromise = null
  return promise
}

/** Reads every stored session, or null when IndexedDB is unavailable. */
export async function readSessionsFromIndexedDb(): Promise<ChatSession[] | null> {
  const db = await openDatabase()
  if (!db) return null

  return new Promise<ChatSession[] | null>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).getAll()
      request.onsuccess = () =>
        resolve(Array.isArray(request.result) ? (request.result as ChatSession[]) : [])
      request.onerror = () => resolve(null)
      transaction.onabort = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/**
 * Reads the current store, applies `update` to it and writes the result in one
 * readwrite transaction.
 *
 * Two renderer windows can save at the same time. Reading the store in this
 * window's memory and then clearing/replacing it would let the later writer
 * drop the sessions the other window just added. The read and the write share
 * one transaction, so IndexedDB serialises them and the merge always sees the
 * latest committed snapshot.
 *
 * Returns the written sessions, or null when IndexedDB is unavailable or the
 * transaction failed.
 */
export async function updateSessionsInIndexedDb(
  update: (stored: ChatSession[]) => ChatSession[]
): Promise<ChatSession[] | null> {
  const db = await openDatabase()
  if (!db) return null

  return new Promise<ChatSession[] | null>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      let written: ChatSession[] | null = null

      // The read request is queued before the writes, so this transaction
      // observes the store as the previous transaction left it.
      const request = store.getAll()
      request.onsuccess = () => {
        try {
          const stored = Array.isArray(request.result) ? (request.result as ChatSession[]) : []
          written = update(stored)
          store.clear()
          for (const session of written) store.put(session)
        } catch {
          try {
            transaction.abort()
          } catch {}
        }
      }
      request.onerror = () => {
        try {
          transaction.abort()
        } catch {}
      }

      transaction.oncomplete = () => resolve(written)
      transaction.onerror = () => resolve(null)
      transaction.onabort = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Tells other renderer tabs that the IndexedDB copy changed. */
export function notifyIndexedDbSessionsChanged(source: string): void {
  try {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(source)
    channel.close()
  } catch {
    // BroadcastChannel is optional; the local cache still works without it.
  }
}

/** Subscribes to changes written by another tab. Returns an unsubscribe fn. */
export function subscribeToIndexedDbSessionChanges(onChange: (source: string) => void): () => void {
  try {
    if (typeof BroadcastChannel === 'undefined') return () => {}
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent) => onChange(String(event.data ?? ''))
    return () => {
      try {
        channel.close()
      } catch {}
    }
  } catch {
    return () => {}
  }
}

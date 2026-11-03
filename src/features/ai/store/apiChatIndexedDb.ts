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

  databasePromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return databasePromise
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

/** Replaces the whole store with `sessions`. */
export async function writeSessionsToIndexedDb(sessions: ChatSession[]): Promise<boolean> {
  const db = await openDatabase()
  if (!db) return false

  return new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      store.clear()
      for (const session of sessions) store.put(session)
      transaction.oncomplete = () => resolve(true)
      transaction.onerror = () => resolve(false)
      transaction.onabort = () => resolve(false)
    } catch {
      resolve(false)
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

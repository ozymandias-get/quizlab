import { queryClient } from '@app/providers/queryClient'
import { TOAST_DURATION } from '@shared/constants/appConstants'
import {
  getStorageItem,
  LOCAL_STORAGE_SYNC_EVENT,
  type LocalStorageChangeDetail,
  writeStorageItem
} from '@shared/hooks/localStorageUtils'
import { getElectronApi } from '@shared/lib/electronApi'
import { Logger } from '@shared/lib/logger'
import { QUERY_KEYS } from '@shared/query/queryKeys'
import { useToastStore } from '@shared/stores/toastStore'

import i18next from 'i18next'

import {
  notifyIndexedDbSessionsChanged,
  readSessionsFromIndexedDb,
  subscribeToIndexedDbSessionChanges,
  writeSessionsToIndexedDb
} from './apiChatIndexedDb'
import type { ChatSession } from './apiChatSessionUtils'

export const LOCAL_STORAGE_KEY = 'quizlab_api_chat_sessions_v2'
const SESSION_SAVE_DEBOUNCE_MS = 300

/**
 * What a user-initiated destructive mutation removed.
 *
 * The merge below exists for two windows appending to the same session, so it
 * cannot tell a deleted message from one the other window still holds. A
 * deletion therefore has to be named explicitly; without it the union would
 * write the deleted session or message back on the next save.
 */
export interface SessionDeletionMarks {
  sessionIds?: readonly string[]
  messageIdsBySession?: Readonly<Record<string, readonly string[]>>
}

function isChatSession(value: unknown): value is ChatSession {
  if (typeof value !== 'object' || value === null) return false
  const session = value as Record<string, unknown>
  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    Array.isArray(session.messages) &&
    typeof session.createdAt === 'number' &&
    typeof session.updatedAt === 'number'
  )
}

let lastRawData: string | null = null
let lastParsedSessions: ChatSession[] = []
let isInternalWrite = false
/** Which renderer tab this module lives in, for BroadcastChannel filtering. */
const persistenceTabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
/** Whether the localStorage quota forced the sessions into IndexedDB. */
let indexedDbAuthoritative = false

export function loadSessionsFromStorage(): ChatSession[] {
  try {
    const data = getStorageItem(LOCAL_STORAGE_KEY)
    if (!data) {
      lastRawData = null
      lastParsedSessions = []
      return []
    }
    if (data === lastRawData) {
      // A copy, not the cached array: callers receive this list and may sort
      // or otherwise reshape it, and the cache has to keep describing what is
      // actually in storage.
      return [...lastParsedSessions]
    }
    const parsed: unknown = JSON.parse(data)
    if (!Array.isArray(parsed)) return []
    const sessions = parsed.filter(isChatSession)
    lastRawData = data
    lastParsedSessions = sessions
    return sessions
  } catch (e) {
    Logger.error('[ChatPersistence] Failed to load api chat sessions', e)
    return []
  }
}

/**
 * Loads the sessions, falling back to the IndexedDB overflow store.
 *
 * A missing or unreadable localStorage value is the signal that the previous
 * write did not fit (the quota path removes the key after a successful
 * IndexedDB write). A valid local value — including `[]` — stays authoritative.
 */
export async function loadSessionsFromStorageAsync(): Promise<ChatSession[]> {
  const local = loadSessionsFromStorage()
  if (local.length > 0) {
    indexedDbAuthoritative = false
    return local
  }

  const raw = getStorageItem(LOCAL_STORAGE_KEY)
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        indexedDbAuthoritative = false
        return local
      }
    } catch {
      // Corrupt local value: the IndexedDB copy is the better answer.
    }
  }

  const stored = await readSessionsFromIndexedDb()
  if (stored === null) return local
  const sessions = stored.filter(isChatSession)
  if (sessions.length === 0) return local

  indexedDbAuthoritative = true
  lastRawData = null
  lastParsedSessions = sessions
  return [...sessions]
}

// Surface storage failures exactly once per failure streak so a full quota
// does not spam the user, and reset as soon as a save succeeds again.
let storageFailureNotified = false

function isQuotaExceededError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

function notifyStorageFailure(error: unknown): void {
  if (storageFailureNotified) return
  storageFailureNotified = true
  try {
    const message =
      error !== null && isQuotaExceededError(error)
        ? i18next.t('api_chat_storage_quota_error')
        : i18next.t('api_chat_storage_write_error', { error: String(error) })
    useToastStore
      .getState()
      .showWarning(
        message,
        i18next.t('api_chat_storage_error_title'),
        undefined,
        TOAST_DURATION.LONG
      )
  } catch {
    // Toasting must never break persistence itself.
  }
}

/** Reads the locally stored sessions, refreshing the in-memory snapshot. */
function readStoredSessions(): ChatSession[] {
  try {
    const raw = getStorageItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    if (raw === lastRawData) {
      // Same reasoning as `loadSessionsFromStorage`: the cached array is
      // shared state and is never handed out directly.
      return [...lastParsedSessions]
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const stored = parsed.filter(isChatSession)
    lastRawData = raw
    lastParsedSessions = stored
    return [...stored]
  } catch {
    return []
  }
}

/**
 * Merges the incoming list with what another tab already wrote.
 *
 * Read-modify-write: another window/tab may have persisted sessions after this
 * tab last loaded. A blind overwrite would silently drop those
 * (last-write-wins data loss). Merge by session id instead.
 */
function mergeSessionLists(
  incomingSessions: ChatSession[],
  storedSessions: ChatSession[],
  deletions?: SessionDeletionMarks
): ChatSession[] {
  const deletedSessionIds = new Set(deletions?.sessionIds ?? [])
  const deletedMessageIds = new Map<string, Set<string>>()
  for (const [sessionId, ids] of Object.entries(deletions?.messageIdsBySession ?? {})) {
    if (!sessionId || ids.length === 0) continue
    deletedMessageIds.set(sessionId, new Set(ids))
  }

  const withoutDeletedMessages = (session: ChatSession): ChatSession => {
    const removed = deletedMessageIds.get(session.id)
    if (!removed) return session
    const messages = session.messages.filter((message) => !removed.has(message.id))
    return messages.length === session.messages.length ? session : { ...session, messages }
  }

  const incoming = incomingSessions
    .filter((session) => !deletedSessionIds.has(session.id))
    .map(withoutDeletedMessages)

  // Drop what this mutation deleted before the union below can resurrect it.
  // `lastParsedSessions` keeps the raw storage snapshot; only the merge view is
  // filtered.
  const stored = storedSessions
    .filter((session) => !deletedSessionIds.has(session.id))
    .map(withoutDeletedMessages)
  if (stored.length === 0) return incoming

  const incomingById = new Map(incoming.map((s) => [s.id, s]))
  const storedById = new Map(stored.map((s) => [s.id, s]))
  const merged: ChatSession[] = []

  for (const [id, inc] of incomingById) {
    const prev = storedById.get(id)
    if (!prev) {
      merged.push(inc)
      continue
    }
    // Same session edited in two tabs: union messages by id so neither
    // tab's appended messages are lost; newer session fields win.
    const base = inc.updatedAt >= prev.updatedAt ? inc : prev
    const other = inc.updatedAt >= prev.updatedAt ? prev : inc
    const msgById = new Map(other.messages.map((m) => [m.id, m]))
    for (const m of base.messages) msgById.set(m.id, m)
    // A clear is not an append. The union below is what stops two tabs from
    // losing each other's appended messages, but it would also resurrect every
    // message a clear just deleted — `updatedAt` makes the emptied copy `base`,
    // and the union seeds from `other`. "Clear this conversation" has to mean
    // the transcript is gone, including in storage, or it comes back on restart.
    const messages =
      inc.messages.length === 0 && prev.messages.length > 0
        ? []
        : [...msgById.values()].sort((a, b) => a.timestamp - b.timestamp)
    merged.push({ ...base, messages, updatedAt: Math.max(inc.updatedAt, prev.updatedAt) })
    storedById.delete(id)
  }
  // Sessions only present in storage (created by the other tab) survive.
  for (const [, s] of storedById) {
    if (!incomingById.has(s.id)) merged.push(s)
  }
  return merged.sort((a, b) => b.updatedAt - a.updatedAt)
}

function mergeSessionsWithStored(
  incomingSessions: ChatSession[],
  deletions?: SessionDeletionMarks
): ChatSession[] {
  return mergeSessionLists(incomingSessions, readStoredSessions(), deletions)
}

async function saveSessionsToStorage(
  sessions: ChatSession[],
  deletions?: SessionDeletionMarks
): Promise<boolean> {
  const merged = indexedDbAuthoritative
    ? mergeSessionLists(sessions, [...lastParsedSessions], deletions)
    : mergeSessionsWithStored(sessions, deletions)

  // Once the quota forced the sessions into IndexedDB, keep writing there.
  // Falling back to localStorage on every save would only throw again.
  if (indexedDbAuthoritative) {
    if (await writeSessionsToIndexedDb(merged)) {
      lastRawData = null
      lastParsedSessions = merged
      storageFailureNotified = false
      notifyIndexedDbSessionsChanged(persistenceTabId)
      try {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI.SESSIONS })
      } catch {}
      return true
    }
    indexedDbAuthoritative = false
  }

  const serialized = JSON.stringify(merged)
  // writeStorageItem keeps the raw failure cause so quota errors can be
  // reported with a dedicated message (see notifyStorageFailure).
  isInternalWrite = true
  let result: ReturnType<typeof writeStorageItem>
  try {
    result = writeStorageItem(LOCAL_STORAGE_KEY, serialized)
  } finally {
    isInternalWrite = false
  }
  if (!result.ok) {
    if (isQuotaExceededError(result.error) && (await writeSessionsToIndexedDb(merged))) {
      // The transcript is safe in IndexedDB. Removing the localStorage key is
      // what tells the next start that the local copy is gone and the
      // overflow store has to be read.
      indexedDbAuthoritative = true
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY)
      } catch {}
      lastRawData = null
      lastParsedSessions = merged
      storageFailureNotified = false
      Logger.warn(
        '[ChatPersistence] localStorage quota exceeded; api chat sessions moved to IndexedDB'
      )
      notifyIndexedDbSessionsChanged(persistenceTabId)
      try {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI.SESSIONS })
      } catch {}
      return true
    }

    Logger.error('[ChatPersistence] Failed to save api chat sessions', result.error ?? undefined)
    notifyStorageFailure(result.error)
    return false
  }
  lastRawData = serialized
  lastParsedSessions = merged
  storageFailureNotified = false
  // Single source of truth: invalidate the sessions query so any stale
  // in-memory copy (e.g. an open composer holding an old list) is refetched
  // from the freshly written storage value instead of overwriting it.
  try {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI.SESSIONS })
  } catch {}
  return true
}

function handleExternalSessionsChange(): void {
  try {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI.SESSIONS })
  } catch {}
}

// Cross-tab + same-tab external mutations must refresh the query cache.
// Installed once at module load; safe in non-browser (SSR/test) environments.
if (typeof window !== 'undefined') {
  try {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY) handleExternalSessionsChange()
    }
    const handleLocalSync = (e: Event) => {
      if (isInternalWrite) return
      const detail = (e as CustomEvent<LocalStorageChangeDetail>).detail
      if (detail?.key === LOCAL_STORAGE_KEY) handleExternalSessionsChange()
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalSync as EventListener)
  } catch {}

  // IndexedDB writes do not produce a `storage` event. BroadcastChannel
  // restores the cross-tab refresh once the quota fallback is active.
  try {
    subscribeToIndexedDbSessionChanges((source) => {
      if (source === persistenceTabId) return
      if (!indexedDbAuthoritative) {
        handleExternalSessionsChange()
        return
      }
      // Invalidate only after the new snapshot is in memory: querying first
      // lets the UI reread `lastParsedSessions` while it is still the old one.
      void readSessionsFromIndexedDb()
        .then((stored) => {
          if (stored === null) return
          lastParsedSessions = stored.filter(isChatSession)
          lastRawData = null
          handleExternalSessionsChange()
        })
        .catch(() => handleExternalSessionsChange())
    })
  } catch {}
}

let pendingSaveSessions: ChatSession[] | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Saves that have started and not finished yet.
 *
 * The debounce timer is not the only writer: a previous debounce tick may
 * still be inside IndexedDB when the app closes. The shutdown flush has to
 * wait for those promises too, not only for the not-yet-started batch.
 */
const inFlightSaves = new Set<Promise<boolean>>()

/**
 * Deletions accumulate for the whole debounce window: a delete followed by an
 * append must still keep the deleted id out of the final write, and the append
 * snapshot already contains the new message.
 */
const pendingDeletedSessionIds = new Set<string>()
const pendingDeletedMessageIds = new Map<string, Set<string>>()

function addSessionDeletionMarks(deletions?: SessionDeletionMarks): void {
  if (!deletions) return
  for (const sessionId of deletions.sessionIds ?? []) {
    if (sessionId) pendingDeletedSessionIds.add(sessionId)
  }
  for (const [sessionId, ids] of Object.entries(deletions.messageIdsBySession ?? {})) {
    if (!sessionId || ids.length === 0) continue
    const deleted = pendingDeletedMessageIds.get(sessionId) ?? new Set<string>()
    for (const messageId of ids) {
      if (messageId) deleted.add(messageId)
    }
    pendingDeletedMessageIds.set(sessionId, deleted)
  }
}

function takeSessionDeletionMarks(): SessionDeletionMarks {
  const messageIdsBySession: Record<string, readonly string[]> = {}
  for (const [sessionId, ids] of pendingDeletedMessageIds) {
    if (ids.size > 0) messageIdsBySession[sessionId] = [...ids]
  }
  const marks: SessionDeletionMarks = {
    sessionIds: [...pendingDeletedSessionIds],
    messageIdsBySession
  }
  pendingDeletedSessionIds.clear()
  pendingDeletedMessageIds.clear()
  return marks
}

function startSave(sessions: ChatSession[], deletions: SessionDeletionMarks): Promise<boolean> {
  const tracked = saveSessionsToStorage(sessions, deletions)
    .then((saved) => {
      if (!saved) {
        // Keep the tombstones for the next write: a failed save must not let
        // the old transcript win once storage has room again.
        addSessionDeletionMarks(deletions)
      }
      return saved
    })
    .finally(() => {
      inFlightSaves.delete(tracked)
    })
  inFlightSaves.add(tracked)
  return tracked
}

export function scheduleSaveSessions(sessions: ChatSession[], deletions?: SessionDeletionMarks) {
  addSessionDeletionMarks(deletions)
  pendingSaveSessions = sessions
  if (saveTimer !== null) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (pendingSaveSessions !== null) {
      const pending = pendingSaveSessions
      pendingSaveSessions = null
      const deletions = takeSessionDeletionMarks()
      // The non-IndexedDB path writes localStorage before its first await, so
      // a test or a shutdown sees the value synchronously; the IndexedDB
      // fallback simply finishes a moment later. Tracked so a shutdown can
      // wait for it.
      void startSave(pending, deletions)
    }
  }, SESSION_SAVE_DEBOUNCE_MS)
}

/**
 * Writes any debounced-but-not-yet-persisted session state.
 * Called on `beforeunload` so a message sent right before the app quits is
 * not lost to the save debounce window.
 */
export async function flushPendingSessions(): Promise<boolean> {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (pendingSaveSessions !== null) {
    const sessions = pendingSaveSessions
    pendingSaveSessions = null
    void startSave(sessions, takeSessionDeletionMarks())
  }

  // A save started by an earlier timer tick may still be writing IndexedDB.
  // Wait until the set drains, including writes that were queued while we
  // were waiting, and report whether every write reached storage.
  let saved = true
  while (inFlightSaves.size > 0) {
    const results = await Promise.allSettled(inFlightSaves)
    for (const result of results) {
      if (result.status === 'rejected' || result.value === false) saved = false
    }
  }
  return saved
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('beforeunload', () => {
      void flushPendingSessions()
    })

    // The main process waits for this answer on window close and app quit:
    // beforeunload cannot await the IndexedDB write.
    const api = getElectronApi()
    api?.onAppFlushPending?.(() => {
      void flushPendingSessions()
        .then((saved) => api.notifyAppFlushComplete(saved))
        .catch(() => api.notifyAppFlushComplete(false))
    })
  } catch {}
}

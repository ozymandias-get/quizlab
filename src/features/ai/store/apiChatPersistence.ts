import { queryClient } from '@app/providers/queryClient'
import { TOAST_DURATION } from '@shared/constants/appConstants'
import {
  getStorageItem,
  LOCAL_STORAGE_SYNC_EVENT,
  type LocalStorageChangeDetail,
  writeStorageItem
} from '@shared/hooks/localStorageUtils'
import { Logger } from '@shared/lib/logger'
import { QUERY_KEYS } from '@shared/query/queryKeys'
import { useToastStore } from '@shared/stores/toastStore'

import i18next from 'i18next'

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

function mergeSessionsWithStored(
  incomingSessions: ChatSession[],
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
  // Read-modify-write: another window/tab may have persisted sessions after
  // this tab last loaded. A blind overwrite would silently drop those
  // (last-write-wins data loss). Merge by session id instead.
  let stored: ChatSession[] = []
  try {
    const raw = getStorageItem(LOCAL_STORAGE_KEY)
    if (raw) {
      if (raw === lastRawData) {
        // Same reasoning as `loadSessionsFromStorage`: the cached array is
        // shared state and is never handed out directly.
        stored = [...lastParsedSessions]
      } else {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          stored = parsed.filter(isChatSession)
          lastRawData = raw
          lastParsedSessions = stored
        }
      }
    }
  } catch {
    stored = []
  }

  // Drop what this mutation deleted before the union below can resurrect it.
  // `lastParsedSessions` keeps the raw storage snapshot; only the merge view is
  // filtered.
  stored = stored
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

function saveSessionsToStorage(sessions: ChatSession[], deletions?: SessionDeletionMarks): boolean {
  const merged = mergeSessionsWithStored(sessions, deletions)
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
}

let pendingSaveSessions: ChatSession[] | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

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
      if (!saveSessionsToStorage(pending, deletions)) {
        // Keep the tombstones for the next write: a failed save must not let
        // the old transcript win once storage has room again.
        addSessionDeletionMarks(deletions)
      }
    }
  }, SESSION_SAVE_DEBOUNCE_MS)
}

/**
 * Writes any debounced-but-not-yet-persisted session state synchronously.
 * Called on `beforeunload` so a message sent right before the app quits is
 * not lost to the save debounce window.
 */
function flushPendingSessions(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (pendingSaveSessions !== null) {
    const sessions = pendingSaveSessions
    pendingSaveSessions = null
    const deletions = takeSessionDeletionMarks()
    if (!saveSessionsToStorage(sessions, deletions)) {
      addSessionDeletionMarks(deletions)
    }
  }
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('beforeunload', flushPendingSessions)
  } catch {}
}

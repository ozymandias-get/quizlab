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

export function loadSessionsFromStorage(): ChatSession[] {
  try {
    const data = getStorageItem(LOCAL_STORAGE_KEY)
    if (!data) return []
    const parsed: unknown = JSON.parse(data)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isChatSession)
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

function mergeSessionsWithStored(incoming: ChatSession[]): ChatSession[] {
  // Read-modify-write: another window/tab may have persisted sessions after
  // this tab last loaded. A blind overwrite would silently drop those
  // (last-write-wins data loss). Merge by session id instead.
  let stored: ChatSession[] = []
  try {
    const raw = getStorageItem(LOCAL_STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) stored = parsed.filter(isChatSession)
    }
  } catch {
    stored = []
  }
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
    const messages = [...msgById.values()].sort((a, b) => a.timestamp - b.timestamp)
    merged.push({ ...base, messages, updatedAt: Math.max(inc.updatedAt, prev.updatedAt) })
    storedById.delete(id)
  }
  // Sessions only present in storage (created by the other tab) survive.
  for (const [, s] of storedById) {
    if (!incomingById.has(s.id)) merged.push(s)
  }
  return merged.sort((a, b) => b.updatedAt - a.updatedAt)
}

function saveSessionsToStorage(sessions: ChatSession[]) {
  const merged = mergeSessionsWithStored(sessions)
  const serialized = JSON.stringify(merged)
  // writeStorageItem keeps the raw failure cause so quota errors can be
  // reported with a dedicated message (see notifyStorageFailure).
  const result = writeStorageItem(LOCAL_STORAGE_KEY, serialized)
  if (!result.ok) {
    Logger.error('[ChatPersistence] Failed to save api chat sessions', result.error ?? undefined)
    notifyStorageFailure(result.error)
    return
  }
  storageFailureNotified = false
  // Single source of truth: invalidate the sessions query so any stale
  // in-memory copy (e.g. an open composer holding an old list) is refetched
  // from the freshly written storage value instead of overwriting it.
  try {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI.SESSIONS })
  } catch {}
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
      const detail = (e as CustomEvent<LocalStorageChangeDetail>).detail
      if (detail?.key === LOCAL_STORAGE_KEY) handleExternalSessionsChange()
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalSync as EventListener)
  } catch {}
}

let pendingSaveSessions: ChatSession[] | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSaveSessions(sessions: ChatSession[]) {
  pendingSaveSessions = sessions
  if (saveTimer !== null) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (pendingSaveSessions !== null) {
      saveSessionsToStorage(pendingSaveSessions)
      pendingSaveSessions = null
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
    saveSessionsToStorage(sessions)
  }
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('beforeunload', flushPendingSessions)
  } catch {}
}

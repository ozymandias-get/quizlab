import { queryClient } from '@app/providers/queryClient'
import {
  LOCAL_STORAGE_SYNC_EVENT,
  type LocalStorageChangeDetail
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
    const data = localStorage.getItem(LOCAL_STORAGE_KEY)
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
    const message = isQuotaExceededError(error)
      ? i18next.t('api_chat_storage_quota_error')
      : i18next.t('api_chat_storage_write_error', { error: String(error) })
    useToastStore
      .getState()
      .showWarning(message, i18next.t('api_chat_storage_error_title'), undefined, 8000)
  } catch {
    // Toasting must never break persistence itself.
  }
}

function saveSessionsToStorage(sessions: ChatSession[]) {
  try {
    const serialized = JSON.stringify(sessions)
    localStorage.setItem(LOCAL_STORAGE_KEY, serialized)
    storageFailureNotified = false
    // Dispatch same-tab sync event so other hook instances and React Query
    // caches (useSessionsQuery with staleTime Infinity) are refreshed
    // synchronously without waiting for the cross-tab `storage` event.
    try {
      window.dispatchEvent(
        new CustomEvent<LocalStorageChangeDetail>(LOCAL_STORAGE_SYNC_EVENT, {
          detail: { key: LOCAL_STORAGE_KEY, value: serialized }
        })
      )
    } catch {}
    // Single source of truth: invalidate the sessions query so any stale
    // in-memory copy (e.g. an open composer holding an old list) is refetched
    // from the freshly written storage value instead of overwriting it.
    try {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI.SESSIONS })
    } catch {}
  } catch (e) {
    Logger.error('[ChatPersistence] Failed to save api chat sessions', e)
    notifyStorageFailure(e)
  }
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

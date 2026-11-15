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
  updateSessionsInIndexedDb
} from './apiChatIndexedDb'
import type { ChatSession } from './apiChatSessionUtils'

export const LOCAL_STORAGE_KEY = 'quizlab_api_chat_sessions_v2'
/**
 * Durable tombstones of user deletions.
 *
 * The in-memory marks only cover the debounce window of the window that made
 * the deletion. Another open window still holds the old transcript, and its
 * next save runs in its own module instance where those marks do not exist.
 * The ledger is the small piece of shared state that tells that save what the
 * user removed.
 */
const DELETIONS_STORAGE_KEY = 'quizlab_api_chat_deletions_v1'
const DELETION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
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
  /**
   * Sessions whose transcript the user cleared, with the clear time.
   *
   * This is not the same thing as an empty session. A window that loaded an
   * empty transcript before another window appended to it must not wipe those
   * new messages; only an explicit clear may remove the older ones.
   */
  clearedSessions?: Readonly<Record<string, number>>
}

interface StoredDeletionLedger {
  sessions: Record<string, number>
  messages: Record<string, Record<string, number>>
  cleared: Record<string, number>
}

function emptyDeletionLedger(): StoredDeletionLedger {
  return { sessions: {}, messages: {}, cleared: {} }
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function readDeletionLedger(): StoredDeletionLedger {
  const raw = getStorageItem(DELETIONS_STORAGE_KEY)
  if (!raw) {
    if (!unsavedDeletionLedger) return emptyDeletionLedger()
    const pending = emptyDeletionLedger()
    mergeLedgers(pending, unsavedDeletionLedger)
    return pending
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return emptyDeletionLedger()
    const source = parsed as Record<string, unknown>
    const ledger = emptyDeletionLedger()
    const now = Date.now()

    if (typeof source.sessions === 'object' && source.sessions !== null) {
      for (const [id, at] of Object.entries(source.sessions as Record<string, unknown>)) {
        if (id && isTimestamp(at) && now - at <= DELETION_RETENTION_MS) {
          ledger.sessions[id] = at
        }
      }
    }
    if (typeof source.cleared === 'object' && source.cleared !== null) {
      for (const [id, at] of Object.entries(source.cleared as Record<string, unknown>)) {
        if (id && isTimestamp(at) && now - at <= DELETION_RETENTION_MS) {
          ledger.cleared[id] = at
        }
      }
    }
    if (typeof source.messages === 'object' && source.messages !== null) {
      for (const [sessionId, ids] of Object.entries(source.messages as Record<string, unknown>)) {
        if (!sessionId || typeof ids !== 'object' || ids === null) continue
        const kept: Record<string, number> = {}
        for (const [messageId, at] of Object.entries(ids as Record<string, unknown>)) {
          if (messageId && isTimestamp(at) && now - at <= DELETION_RETENTION_MS) {
            kept[messageId] = at
          }
        }
        if (Object.keys(kept).length > 0) ledger.messages[sessionId] = kept
      }
    }
    if (unsavedDeletionLedger) mergeLedgers(ledger, unsavedDeletionLedger)
    return ledger
  } catch {
    if (!unsavedDeletionLedger) return emptyDeletionLedger()
    const pending = emptyDeletionLedger()
    mergeLedgers(pending, unsavedDeletionLedger)
    return pending
  }
}

/**
 * Tombstones that could not be written to localStorage.
 *
 * Keeping them in memory lets this tab keep filtering stale snapshots and
 * gives the next save another chance to persist them. If the failure is
 * temporary, the deletion becomes durable without user action.
 */
let unsavedDeletionLedger: StoredDeletionLedger | null = null

function mergeLedgers(target: StoredDeletionLedger, source: StoredDeletionLedger): void {
  for (const [id, at] of Object.entries(source.sessions)) {
    target.sessions[id] = Math.max(target.sessions[id] ?? 0, at)
  }
  for (const [sessionId, ids] of Object.entries(source.messages)) {
    const kept = target.messages[sessionId] ?? {}
    for (const [messageId, at] of Object.entries(ids)) {
      kept[messageId] = Math.max(kept[messageId] ?? 0, at)
    }
    target.messages[sessionId] = kept
  }
  for (const [id, at] of Object.entries(source.cleared)) {
    target.cleared[id] = Math.max(target.cleared[id] ?? 0, at)
  }
}

function writeDeletionLedger(ledger: StoredDeletionLedger): boolean {
  const result = writeStorageItem(DELETIONS_STORAGE_KEY, JSON.stringify(ledger))
  if (result.ok) {
    unsavedDeletionLedger = null
    return true
  }

  // Tombstones are a safety net, not the transcript itself: keep them in
  // memory and retry instead of interrupting the user.
  const pending = emptyDeletionLedger()
  mergeLedgers(pending, unsavedDeletionLedger ?? emptyDeletionLedger())
  mergeLedgers(pending, ledger)
  unsavedDeletionLedger = pending
  return false
}

function retryUnsavedDeletionLedger(): void {
  if (!unsavedDeletionLedger) return
  writeDeletionLedger(unsavedDeletionLedger)
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

/**
 * Durable source-of-truth marker for the sessions store.
 *
 * The localStorage key is normally removed after a successful IndexedDB move.
 * If that removal fails, the stale local array would win on the next start and
 * the sessions written to IndexedDB would look lost. The marker says which
 * store is authoritative independently of whether the old key could be
 * removed.
 */
const STORAGE_MODE_KEY = 'quizlab_api_chat_storage_mode_v1'
const STORAGE_MODE_INDEXEDDB = 'indexeddb'
/**
 * Fallback marker written into the sessions key itself.
 *
 * A quota error can reject the tiny mode key while the large stale transcript
 * is still there. Replacing that transcript with this small object frees the
 * space and leaves a marker the loader can recognise, without ever exposing it
 * as a session.
 */
const SESSIONS_MODE_SENTINEL = '{"__quizlab_storage_mode__":"indexeddb"}'

function markIndexedDbAuthoritative(): void {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, STORAGE_MODE_INDEXEDDB)
    return
  } catch {}

  // The dedicated marker could not be written. The sessions key is about to be
  // removed anyway; replacing its stale contents with a small sentinel is the
  // fallback that still identifies IndexedDB as the source on the next start.
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, SESSIONS_MODE_SENTINEL)
  } catch {}
}

function clearStorageModeMarker(): void {
  try {
    localStorage.removeItem(STORAGE_MODE_KEY)
  } catch {}
}

/** Whether the shared marker currently names IndexedDB as the source. */
function isIndexedDbSourceMarked(): boolean {
  return (
    getStorageItem(STORAGE_MODE_KEY) === STORAGE_MODE_INDEXEDDB ||
    getStorageItem(LOCAL_STORAGE_KEY) === SESSIONS_MODE_SENTINEL
  )
}

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
  // The marker, not the presence of the localStorage key, decides the source.
  // A failed removal after the IndexedDB move leaves a stale local array whose
  // value must not beat the newer overflow store.
  if (isIndexedDbSourceMarked()) {
    const stored = await readSessionsFromIndexedDb()
    if (stored !== null) {
      const sessions = stored.filter(isChatSession)
      indexedDbAuthoritative = true
      lastRawData = null
      lastParsedSessions = sessions
      // Try again to drop the stale local copy. If removal still fails, the
      // marker keeps the next start on IndexedDB.
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY)
      } catch {}
      return [...sessions]
    }
    // IndexedDB is unavailable: fall back to the local copy and clear the
    // marker so the next successful local write is authoritative again.
    clearStorageModeMarker()
    indexedDbAuthoritative = false
  }

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
  markIndexedDbAuthoritative()
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
    if (!raw) {
      lastRawData = null
      lastParsedSessions = []
      return []
    }
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
  retryUnsavedDeletionLedger()
  const ledger = readDeletionLedger()
  const deletedSessionIds = new Set([
    ...Object.keys(ledger.sessions),
    ...(deletions?.sessionIds ?? [])
  ])

  const deletedMessageIds = new Map<string, Set<string>>()
  const addMessageDeletions = (marks: Record<string, readonly string[]> | undefined) => {
    for (const [sessionId, ids] of Object.entries(marks ?? {})) {
      if (!sessionId || ids.length === 0) continue
      const removed = deletedMessageIds.get(sessionId) ?? new Set<string>()
      for (const id of ids) if (id) removed.add(id)
      deletedMessageIds.set(sessionId, removed)
    }
  }
  for (const [sessionId, ids] of Object.entries(ledger.messages)) {
    addMessageDeletions({ [sessionId]: Object.keys(ids) })
  }
  addMessageDeletions(deletions?.messageIdsBySession)

  // A clear is a point in time, not "this list happens to be empty": messages
  // the clearing window had not seen yet are older than the clear and go away,
  // while a message another window appends afterwards survives.
  const clearedSessions = new Map<string, number>(Object.entries(ledger.cleared))
  for (const [sessionId, at] of Object.entries(deletions?.clearedSessions ?? {})) {
    if (!sessionId || !isTimestamp(at)) continue
    const previous = clearedSessions.get(sessionId) ?? 0
    clearedSessions.set(sessionId, Math.max(previous, at))
  }

  const withoutDeletedMessages = (session: ChatSession): ChatSession => {
    const removed = deletedMessageIds.get(session.id)
    const clearedAt = clearedSessions.get(session.id)
    let messages = session.messages
    if (removed) {
      messages = messages.filter((message) => !removed.has(message.id))
    }
    if (clearedAt !== undefined) {
      messages = messages.filter(
        (message) => typeof message.timestamp !== 'number' || message.timestamp > clearedAt
      )
    }
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
    // tab's appended messages are lost; newer session fields win. An empty
    // incoming list is not a clear — the deletion ledger above already
    // removed what the user explicitly deleted, so an old empty snapshot
    // cannot wipe a transcript another window has since appended to.
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

function mergeSessionsWithStored(
  incomingSessions: ChatSession[],
  deletions?: SessionDeletionMarks
): ChatSession[] {
  return mergeSessionLists(incomingSessions, readStoredSessions(), deletions)
}

/**
 * Merges against the store as it is inside the IndexedDB transaction.
 *
 * `fallbackStored` only matters when the overflow store is still empty (for
 * example the very first quota fallback): the merge then keeps the local copy
 * it is replacing instead of trusting one window's snapshot.
 */
async function writeSessionsThroughIndexedDb(
  sessions: ChatSession[],
  deletions: SessionDeletionMarks | undefined,
  fallbackStored: ChatSession[]
): Promise<boolean> {
  const written = await updateSessionsInIndexedDb((stored) =>
    mergeSessionLists(sessions, stored.length > 0 ? stored : fallbackStored, deletions)
  )
  if (written === null) return false
  markIndexedDbAuthoritative()
  lastRawData = null
  lastParsedSessions = written
  storageFailureNotified = false
  notifyIndexedDbSessionsChanged(persistenceTabId)
  try {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI.SESSIONS })
  } catch {}
  return true
}

async function saveSessionsToStorage(
  sessions: ChatSession[],
  deletions?: SessionDeletionMarks
): Promise<boolean> {
  // The marker is shared by every renderer. Re-reading it before the save
  // keeps this tab from writing one source while another tab has just switched
  // to the other one.
  indexedDbAuthoritative = isIndexedDbSourceMarked()

  // Once the quota forced the sessions into IndexedDB, keep writing there.
  // Falling back to localStorage on every save would only throw again.
  if (indexedDbAuthoritative) {
    if (await writeSessionsThroughIndexedDb(sessions, deletions, [...lastParsedSessions])) {
      return true
    }
    indexedDbAuthoritative = false
    clearStorageModeMarker()
  }

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
    if (
      isQuotaExceededError(result.error) &&
      (await writeSessionsThroughIndexedDb(sessions, deletions, readStoredSessions()))
    ) {
      // The transcript is safe in IndexedDB. Removing the localStorage key is
      // what tells the next start that the local copy is gone and the
      // overflow store has to be read.
      indexedDbAuthoritative = true
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY)
      } catch {}
      Logger.warn(
        '[ChatPersistence] localStorage quota exceeded; api chat sessions moved to IndexedDB'
      )
      return true
    }

    Logger.error('[ChatPersistence] Failed to save api chat sessions', result.error ?? undefined)
    notifyStorageFailure(result.error)
    return false
  }
  indexedDbAuthoritative = false
  clearStorageModeMarker()
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

  // A tombstone write that failed still has to reach tabs that hold the old
  // transcript. The receiving tab applies the marks and retries the durable
  // ledger itself.
  try {
    subscribeToDeletionMarks((marks) => addSessionDeletionMarks(marks, false))
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
const pendingClearedSessions = new Map<string, number>()

const DELETIONS_CHANNEL_NAME = 'quizlab-api-chat-deletions'

/**
 * Sends fresh tombstones to the other open renderers.
 *
 * This is the fallback when the durable ledger could not be written: an open
 * tab that still holds the old transcript must apply the deletion before its
 * next save, or it would merge the deleted rows back.
 */
function broadcastDeletionMarks(deletions: SessionDeletionMarks): void {
  try {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(DELETIONS_CHANNEL_NAME)
    channel.postMessage({
      sessionIds: deletions.sessionIds ?? [],
      messageIdsBySession: deletions.messageIdsBySession ?? {},
      clearedSessions: deletions.clearedSessions ?? {}
    })
    channel.close()
  } catch {}
}

function sanitizeDeletionMarks(value: unknown): SessionDeletionMarks | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>

  const sessionIds = Array.isArray(source.sessionIds)
    ? source.sessionIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []

  const messageIdsBySession: Record<string, string[]> = {}
  if (typeof source.messageIdsBySession === 'object' && source.messageIdsBySession !== null) {
    for (const [sessionId, ids] of Object.entries(
      source.messageIdsBySession as Record<string, unknown>
    )) {
      if (!sessionId || !Array.isArray(ids)) continue
      const clean = ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      if (clean.length > 0) messageIdsBySession[sessionId] = clean
    }
  }

  const clearedSessions: Record<string, number> = {}
  if (typeof source.clearedSessions === 'object' && source.clearedSessions !== null) {
    for (const [sessionId, at] of Object.entries(
      source.clearedSessions as Record<string, unknown>
    )) {
      if (sessionId && isTimestamp(at)) clearedSessions[sessionId] = at
    }
  }

  if (
    sessionIds.length === 0 &&
    Object.keys(messageIdsBySession).length === 0 &&
    Object.keys(clearedSessions).length === 0
  ) {
    return null
  }
  return { sessionIds, messageIdsBySession, clearedSessions }
}

function subscribeToDeletionMarks(onMarks: (marks: SessionDeletionMarks) => void): () => void {
  try {
    if (typeof BroadcastChannel === 'undefined') return () => {}
    const channel = new BroadcastChannel(DELETIONS_CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent) => {
      try {
        const marks = sanitizeDeletionMarks(event.data)
        if (marks) onMarks(marks)
      } catch {}
    }
    return () => {
      try {
        channel.close()
      } catch {}
    }
  } catch {
    return () => {}
  }
}

function addSessionDeletionMarks(deletions?: SessionDeletionMarks, relay = true): void {
  if (!deletions) return
  const now = Date.now()

  for (const sessionId of deletions.sessionIds ?? []) {
    if (!sessionId) continue
    pendingDeletedSessionIds.add(sessionId)
    // A deleted session no longer needs its message/clear tombstones.
    pendingDeletedMessageIds.delete(sessionId)
    pendingClearedSessions.delete(sessionId)
  }
  for (const [sessionId, at] of Object.entries(deletions.clearedSessions ?? {})) {
    if (!sessionId || !isTimestamp(at)) continue
    const previous = pendingClearedSessions.get(sessionId) ?? 0
    pendingClearedSessions.set(sessionId, Math.max(previous, at))
  }
  for (const [sessionId, ids] of Object.entries(deletions.messageIdsBySession ?? {})) {
    if (!sessionId || ids.length === 0) continue
    const deleted = pendingDeletedMessageIds.get(sessionId) ?? new Set<string>()
    for (const messageId of ids) {
      if (messageId) deleted.add(messageId)
    }
    pendingDeletedMessageIds.set(sessionId, deleted)
  }

  // Persist immediately: another window may save before this debounce fires.
  const ledger = readDeletionLedger()
  let changed = false
  for (const sessionId of deletions.sessionIds ?? []) {
    if (!sessionId) continue
    ledger.sessions[sessionId] = now
    delete ledger.cleared[sessionId]
    delete ledger.messages[sessionId]
    changed = true
  }
  for (const [sessionId, at] of Object.entries(deletions.clearedSessions ?? {})) {
    if (!sessionId || !isTimestamp(at)) continue
    ledger.cleared[sessionId] = Math.max(ledger.cleared[sessionId] ?? 0, at)
    changed = true
  }
  for (const [sessionId, ids] of Object.entries(deletions.messageIdsBySession ?? {})) {
    if (!sessionId || ids.length === 0) continue
    const deleted = ledger.messages[sessionId] ?? {}
    for (const messageId of ids) {
      if (messageId) deleted[messageId] = now
    }
    ledger.messages[sessionId] = deleted
    changed = true
  }
  if (changed) {
    const written = writeDeletionLedger(ledger)
    if (!written && relay) broadcastDeletionMarks(deletions)
  }
}

function takeSessionDeletionMarks(): SessionDeletionMarks {
  const messageIdsBySession: Record<string, readonly string[]> = {}
  for (const [sessionId, ids] of pendingDeletedMessageIds) {
    if (ids.size > 0) messageIdsBySession[sessionId] = [...ids]
  }
  const clearedSessions: Record<string, number> = {}
  for (const [sessionId, at] of pendingClearedSessions) {
    clearedSessions[sessionId] = at
  }
  const marks: SessionDeletionMarks = {
    sessionIds: [...pendingDeletedSessionIds],
    messageIdsBySession,
    clearedSessions
  }
  pendingDeletedSessionIds.clear()
  pendingDeletedMessageIds.clear()
  pendingClearedSessions.clear()
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
    api?.onAppFlushPending?.((requestId) => {
      void flushPendingSessions()
        .then((saved) => api.notifyAppFlushComplete(saved, requestId))
        .catch(() => api.notifyAppFlushComplete(false, requestId))
    })
  } catch {}
}

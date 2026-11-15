import { TOAST_DURATION } from '@shared/constants/appConstants'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import {
  getStorageItem,
  removeStorageItem,
  writeStorageItem
} from '@shared/hooks/localStorageUtils'
import { useToastStore } from '@shared/stores/toastStore'

import i18next from 'i18next'

import { normalizeConversationUrl } from './conversationUrl'

/** How many recently used AI conversations the home page keeps around. */
export const RECENT_AI_WORK_LIMIT = 10

export interface RecentAiWorkEntry {
  /** Stable identity: one entry per AI site + conversation URL pair. */
  id: string
  modelId: string
  /** Conversation URL the entry opens. */
  url: string
  /** Epoch milliseconds of the last successful send. */
  lastUsedAt: number
  /** Name of the PDF whose content was sent to this conversation, if any. */
  documentName?: string
}

const MAX_DOCUMENT_NAME_LENGTH = 180

/** Largest instant `Date` can represent; `Intl` throws beyond it. */
const MAX_VALID_TIMESTAMP = 8_640_000_000_000_000

/**
 * Storage is user-writable, so a corrupt row must not reach a formatter that
 * throws on an out-of-range date. Rows outside this range are treated as having
 * an unknown time, the same as a missing number.
 */
export function isValidLastUsedAt(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_VALID_TIMESTAMP
}

function normalizeDocumentName(rawName: string | undefined): string | undefined {
  if (!rawName) return undefined
  const name = rawName.replaceAll(/\s+/g, ' ').trim()
  if (!name) return undefined
  return name.length > MAX_DOCUMENT_NAME_LENGTH
    ? `${name.slice(0, MAX_DOCUMENT_NAME_LENGTH - 1)}…`
    : name
}

export function createRecentAiWorkEntry(
  modelId: string,
  rawUrl: string,
  lastUsedAt: number = Date.now(),
  documentName?: string
): RecentAiWorkEntry | null {
  if (!modelId) return null
  const url = normalizeConversationUrl(rawUrl)
  if (!url) return null
  const normalizedDocument = normalizeDocumentName(documentName)
  return {
    id: `${modelId}::${url}`,
    modelId,
    url,
    lastUsedAt,
    ...(normalizedDocument ? { documentName: normalizedDocument } : {})
  }
}

/**
 * Identity of the card a row occupies on AI Home.
 *
 * A card shows the site and the document, never the conversation title, so two
 * conversations used with the same document paint as identical rows — the user
 * sees "three of the same work". They collapse into one card and the most
 * recent conversation wins.
 *
 * A row without a document keeps its conversation identity: there is nothing to
 * group those rows by, and merging unrelated chats into a single "no document"
 * card would hide them behind whichever was used last.
 */
export function recentAiWorkCardKey(entry: RecentAiWorkEntry): string {
  return entry.documentName ? `${entry.modelId}::${entry.documentName}` : entry.id
}

/**
 * Puts `entry` at the top, removes the previous copy and keeps the list
 * bounded. Ordering is by usage, not by insertion, so an old conversation the
 * user returned to becomes the first card again.
 *
 * Every other row for the same site + document is dropped as well: those rows
 * render as the same card, so keeping an older conversation behind it would
 * bring the duplicate straight back on the next read.
 */
export function upsertRecentAiWork(
  entries: RecentAiWorkEntry[],
  entry: RecentAiWorkEntry,
  limit: number = RECENT_AI_WORK_LIMIT
): RecentAiWorkEntry[] {
  const previous = entries.find((current) => current.id === entry.id)
  // A later send without a file must not erase the PDF association of the same
  // conversation; the card is about "what was this chat used with".
  const merged =
    entry.documentName || !previous?.documentName
      ? entry
      : { ...entry, documentName: previous.documentName }
  const cardKey = recentAiWorkCardKey(merged)
  const remaining = entries.filter(
    (current) => current.id !== merged.id && recentAiWorkCardKey(current) !== cardKey
  )
  return [merged, ...remaining].slice(0, limit)
}

/** Drops malformed storage rows, duplicate identity keys and conversations that share one card. */
export function sanitizeRecentAiWork(value: unknown): RecentAiWorkEntry[] {
  if (!Array.isArray(value)) return []

  const byId = new Map<string, RecentAiWorkEntry>()
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue
    const row = candidate as Partial<RecentAiWorkEntry>
    if (typeof row.modelId !== 'string' || typeof row.url !== 'string') continue
    const lastUsedAt =
      typeof row.lastUsedAt === 'number' && isValidLastUsedAt(row.lastUsedAt)
        ? row.lastUsedAt
        : Date.now()
    const entry = createRecentAiWorkEntry(
      row.modelId,
      row.url,
      lastUsedAt,
      typeof row.documentName === 'string' ? row.documentName : undefined
    )
    if (!entry) continue
    const existing = byId.get(entry.id)
    if (!existing || existing.lastUsedAt < entry.lastUsedAt) {
      byId.set(entry.id, entry)
    }
  }

  // Second pass over what a card can actually show. Stored lists written before
  // this grouping existed can hold several conversations per document, and the
  // read path is where they collapse without a migration.
  const byCard = new Map<string, RecentAiWorkEntry>()
  for (const entry of byId.values()) {
    const cardKey = recentAiWorkCardKey(entry)
    const existing = byCard.get(cardKey)
    if (!existing || existing.lastUsedAt < entry.lastUsedAt) {
      byCard.set(cardKey, entry)
    }
  }

  return [...byCard.values()]
    .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
    .slice(0, RECENT_AI_WORK_LIMIT)
}

export function readRecentAiWork(): RecentAiWorkEntry[] {
  const raw = getStorageItem(STORAGE_KEYS.RECENT_AI_WORK)
  if (!raw) return []
  try {
    return sanitizeRecentAiWork(JSON.parse(raw))
  } catch {
    return []
  }
}

let recentWorkWriteFailureNotified = false

function reportRecentWorkWriteFailure(): void {
  if (recentWorkWriteFailureNotified) return
  recentWorkWriteFailureNotified = true
  try {
    useToastStore
      .getState()
      .showWarning(
        i18next.t('toast_recent_work_save_failed'),
        i18next.t('toast_system_title'),
        undefined,
        TOAST_DURATION.LONG
      )
  } catch {
    // A toast failure must never break the write path.
  }
}

function writeRecentAiWork(entries: RecentAiWorkEntry[]): boolean {
  const result = writeStorageItem(STORAGE_KEYS.RECENT_AI_WORK, JSON.stringify(entries))
  if (result.ok) {
    recentWorkWriteFailureNotified = false
    return true
  }
  reportRecentWorkWriteFailure()
  return false
}

export function recordRecentAiWork(entry: RecentAiWorkEntry): void {
  writeRecentAiWork(upsertRecentAiWork(readRecentAiWork(), entry))
}

/**
 * Swaps the provisional entry recorded at submit time for the conversation the
 * provider actually navigated to. Without this a brand-new chat would leave the
 * landing page in history alongside (or instead of) the real conversation.
 */
export function replaceRecentAiWork(previous: RecentAiWorkEntry, next: RecentAiWorkEntry): void {
  if (previous.id === next.id) {
    recordRecentAiWork(next)
    return
  }
  const remaining = readRecentAiWork().filter((entry) => entry.id !== previous.id)
  writeRecentAiWork(upsertRecentAiWork(remaining, next))
}

export function removeRecentAiWork(id: string): void {
  const current = readRecentAiWork()
  const target = current.find((entry) => entry.id === id)
  if (!target) {
    writeRecentAiWork(current.filter((entry) => entry.id !== id))
    return
  }
  // The card stands for every conversation used with that document, so removing
  // it must not let an older one resurface on the next read.
  const cardKey = recentAiWorkCardKey(target)
  writeRecentAiWork(current.filter((entry) => recentAiWorkCardKey(entry) !== cardKey))
}

export function clearRecentAiWork(): void {
  if (removeStorageItem(STORAGE_KEYS.RECENT_AI_WORK)) {
    recentWorkWriteFailureNotified = false
    return
  }
  reportRecentWorkWriteFailure()
}

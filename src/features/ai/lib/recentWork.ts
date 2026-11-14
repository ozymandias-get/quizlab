import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import {
  getStorageItem,
  removeStorageItem,
  writeStorageItem
} from '@shared/hooks/localStorageUtils'

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
 * Puts `entry` at the top, removes the previous copy and keeps the list
 * bounded. Ordering is by usage, not by insertion, so an old conversation the
 * user returned to becomes the first card again.
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
  return [merged, ...entries.filter((current) => current.id !== entry.id)].slice(0, limit)
}

/** Drops malformed storage rows and duplicate identity keys. */
export function sanitizeRecentAiWork(value: unknown): RecentAiWorkEntry[] {
  if (!Array.isArray(value)) return []

  const byId = new Map<string, RecentAiWorkEntry>()
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue
    const row = candidate as Partial<RecentAiWorkEntry>
    if (typeof row.modelId !== 'string' || typeof row.url !== 'string') continue
    const lastUsedAt =
      typeof row.lastUsedAt === 'number' && Number.isFinite(row.lastUsedAt)
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

  return [...byId.values()]
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

function writeRecentAiWork(entries: RecentAiWorkEntry[]): void {
  writeStorageItem(STORAGE_KEYS.RECENT_AI_WORK, JSON.stringify(entries))
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
  writeRecentAiWork(readRecentAiWork().filter((entry) => entry.id !== id))
}

export function clearRecentAiWork(): void {
  removeStorageItem(STORAGE_KEYS.RECENT_AI_WORK)
}

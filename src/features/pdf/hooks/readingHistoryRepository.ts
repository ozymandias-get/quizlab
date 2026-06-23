import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { Logger, reportSuppressedError } from '@shared/lib/logger'

import type { LastReadingInfo } from './types'

export const MAX_RECENT_PDFS = 24

export function sanitizeReadingInfo(info: unknown): LastReadingInfo | null {
  if (!info || typeof info !== 'object') return null
  const entry = info as Partial<LastReadingInfo>
  if (!entry.path || !entry.name) return null

  const parsedLastOpenedAt =
    typeof entry.lastOpenedAt === 'number' && Number.isFinite(entry.lastOpenedAt)
      ? entry.lastOpenedAt
      : undefined

  return {
    name: entry.name,
    page: entry.page || 1,
    totalPages: entry.totalPages || 0,
    path: entry.path,
    ...(parsedLastOpenedAt !== undefined ? { lastOpenedAt: parsedLastOpenedAt } : {})
  }
}

export function migrateReadingHistory(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING)
    if (!stored) return

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return

    let migrated = false
    const migratedItems = parsed.map((item) => {
      if (item && typeof item === 'object' && item.path && item.name) {
        if (item.mode || item.libraryId) {
          migrated = true
        }
        const { mode, libraryId, ...clean } = item
        return clean
      }
      return item
    })

    if (migrated) {
      localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify(migratedItems))
      Logger.info('[ReadingHistory] Migrated old entries (stripped library fields)')
    }
  } catch (err) {
    reportSuppressedError('readingHistory.migrate', { cause: err })
  }
}

export function parseReadingHistory(stored: string | null): LastReadingInfo[] {
  if (!stored) return []

  try {
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      const history = parsed
        .map((item) => sanitizeReadingInfo(item))
        .filter((x): x is NonNullable<typeof x> => x != undefined)
      return history.slice(0, MAX_RECENT_PDFS)
    }

    const legacySingle = sanitizeReadingInfo(parsed)
    return legacySingle ? [legacySingle] : []
  } catch (err) {
    reportSuppressedError('readingHistory.parse', { cause: err })
    return []
  }
}

export function readReadingHistory(): LastReadingInfo[] {
  try {
    return parseReadingHistory(localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING))
  } catch (err) {
    reportSuppressedError('readingHistory.read', { cause: err })
    return []
  }
}

export function writeReadingHistory(items: LastReadingInfo[]): void {
  try {
    if (items.length > 0) {
      localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify(items))
    } else {
      localStorage.removeItem(STORAGE_KEYS.LAST_PDF_READING)
    }
  } catch (err) {
    reportSuppressedError('readingHistory.write', { cause: err })
  }
}

export function upsertRecentHistory(
  history: LastReadingInfo[],
  info: LastReadingInfo
): LastReadingInfo[] {
  const filtered = history.filter((item) => item.path !== info.path)
  return [info, ...filtered].slice(0, MAX_RECENT_PDFS)
}

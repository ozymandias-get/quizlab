import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { reportSuppressedError } from '@shared/lib/logger'
import type { LastReadingInfo } from './types'

export const MAX_RECENT_PDFS = 24

export const sanitizeReadingInfo = (data: unknown): LastReadingInfo | null => {
  if (!data || typeof data !== 'object') return null
  const item = data as Partial<LastReadingInfo>
  if (!item.path || !item.name) return null

  const parsedLastOpenedAt =
    typeof item.lastOpenedAt === 'number' && Number.isFinite(item.lastOpenedAt)
      ? item.lastOpenedAt
      : undefined

  return {
    name: item.name,
    page: item.page || 1,
    totalPages: item.totalPages || 0,
    path: item.path,
    ...(parsedLastOpenedAt !== undefined ? { lastOpenedAt: parsedLastOpenedAt } : {})
  }
}

export const parseReadingHistory = (stored: string | null): LastReadingInfo[] => {
  if (!stored) return []

  try {
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      const history = parsed
        .map((item) => sanitizeReadingInfo(item))
        .filter((item): item is LastReadingInfo => Boolean(item))
      return history.slice(0, MAX_RECENT_PDFS)
    }

    const legacySingle = sanitizeReadingInfo(parsed)
    return legacySingle ? [legacySingle] : []
  } catch (err) {
    reportSuppressedError('readingHistory.parse', { cause: err })
    return []
  }
}

export const readReadingHistory = (): LastReadingInfo[] => {
  try {
    return parseReadingHistory(localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING))
  } catch (err) {
    reportSuppressedError('readingHistory.read', { cause: err })
    return []
  }
}

export const writeReadingHistory = (items: LastReadingInfo[]): void => {
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

export const upsertRecentHistory = (
  history: LastReadingInfo[],
  info: LastReadingInfo
): LastReadingInfo[] => {
  const filtered = history.filter((item) => item.path !== info.path)
  return [info, ...filtered].slice(0, MAX_RECENT_PDFS)
}

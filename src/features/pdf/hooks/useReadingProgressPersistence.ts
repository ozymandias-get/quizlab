import { create } from 'zustand'

import {
  MAX_RECENT_PDFS,
  migrateReadingHistory,
  readReadingHistory,
  upsertRecentHistory,
  writeReadingHistory
} from './readingHistoryRepository'
import type { LastReadingInfo, ReadingProgressUpdate } from './types'

const READING_PROGRESS_DEBOUNCE_MS = 400

let readingProgressDebounceTimer: ReturnType<typeof setTimeout> | null = null
let pendingReadingProgressApply: (() => void) | null = null

const recentReadingInfoRef: { current: LastReadingInfo[] } = { current: [] }

const clearDebounce = (): void => {
  if (readingProgressDebounceTimer) {
    clearTimeout(readingProgressDebounceTimer)
    readingProgressDebounceTimer = null
  }
  pendingReadingProgressApply = null
}

const flushPendingDebounce = (): void => {
  if (readingProgressDebounceTimer) {
    clearTimeout(readingProgressDebounceTimer)
    readingProgressDebounceTimer = null
  }
  const apply = pendingReadingProgressApply
  pendingReadingProgressApply = null
  apply?.()
}

interface ReadingProgressState {
  recentReadingInfo: LastReadingInfo[]
}

interface ReadingProgressActions {
  setRecentReadingInfo: (items: LastReadingInfo[]) => void
}

type ReadingProgressStore = ReadingProgressState & ReadingProgressActions

const syncRef = (items: LastReadingInfo[]): void => {
  recentReadingInfoRef.current = items
}

const persistRecentReadingInfo = (items: LastReadingInfo[]): void => {
  writeReadingHistory(items)
  syncRef(items)
  useReadingProgressStore.setState({ recentReadingInfo: items })
}

const updateReadingProgress = (update: ReadingProgressUpdate): void => {
  const { path, page, totalPages, lastOpenedAt } = update
  const current = useReadingProgressStore.getState().recentReadingInfo
  const existing = current.find((entry) => entry.path === path)

  if (!existing) {
    if (!path) return
    const newEntry: LastReadingInfo = {
      path,
      name: path.replace(/^.*[/\\]/, '') || path,
      page: typeof page === 'number' ? Math.max(1, page) : 1,
      totalPages: typeof totalPages === 'number' ? Math.max(0, totalPages) : 0,
      lastOpenedAt: lastOpenedAt ?? Date.now()
    }
    persistRecentReadingInfo(upsertRecentHistory(current, newEntry))
    return
  }

  const nextInfo: LastReadingInfo = {
    ...existing,
    ...(typeof page === 'number' ? { page: Math.max(1, page) } : {}),
    ...(typeof totalPages === 'number' ? { totalPages: Math.max(0, totalPages) } : {}),
    lastOpenedAt: lastOpenedAt ?? Date.now()
  }

  const applyPersist = () => {
    persistRecentReadingInfo(upsertRecentHistory(current, nextInfo))
  }

  const shouldDebounce = typeof page === 'number' && typeof totalPages !== 'number'

  if (shouldDebounce) {
    pendingReadingProgressApply = applyPersist
    if (readingProgressDebounceTimer) {
      clearTimeout(readingProgressDebounceTimer)
    }
    readingProgressDebounceTimer = setTimeout(() => {
      readingProgressDebounceTimer = null
      const apply = pendingReadingProgressApply
      pendingReadingProgressApply = null
      apply?.()
    }, READING_PROGRESS_DEBOUNCE_MS)
    return
  }

  clearDebounce()
  applyPersist()
}

const upsertLastReadingInfo = (info: LastReadingInfo): void => {
  const current = useReadingProgressStore.getState().recentReadingInfo
  persistRecentReadingInfo(upsertRecentHistory(current, info))
}

const clearLastReading = (path?: string): void => {
  clearDebounce()
  const current = useReadingProgressStore.getState().recentReadingInfo
  if (!path) {
    persistRecentReadingInfo([])
    return
  }
  persistRecentReadingInfo(current.filter((entry) => entry.path !== path))
}

const restoreRecentReading = (info: LastReadingInfo, index = 0): void => {
  const current = useReadingProgressStore.getState().recentReadingInfo
  const history = current.filter((entry) => entry.path !== info.path)
  const safeIndex = Math.max(0, Math.min(index, history.length))
  const restored: LastReadingInfo = {
    ...info,
    page: info.page || 1,
    totalPages: info.totalPages || 0,
    lastOpenedAt: info.lastOpenedAt ?? Date.now()
  }

  const next = [...history]
  next.splice(safeIndex, 0, restored)
  persistRecentReadingInfo(next.slice(0, MAX_RECENT_PDFS))
}

const getLastReadingInfo = (): LastReadingInfo | null => {
  return useReadingProgressStore.getState().recentReadingInfo[0] || null
}

const getRecentReadingInfo = (): LastReadingInfo[] => {
  return useReadingProgressStore.getState().recentReadingInfo
}

/**
 * Resets the reading progress store and re-reads the persisted history
 * from disk. Test-only helper.
 */
export const resetReadingProgressStore = (): void => {
  clearDebounce()
  const items = readReadingHistory()
  syncRef(items)
  useReadingProgressStore.setState({ recentReadingInfo: items })
}

/**
 * Singleton zustand store for PDF reading progress. The previous
 * implementation was a regular hook with local `useState`, so every
 * consumer (LeftPanel, FocusOverlay, etc.) ended up with its own copy of
 * the recent-reading list. That broke the BottomBar Focus button and the
 * focus-mode PDF body the same way the PDF tab store did. Sharing the
 * store across the whole tree keeps resume/recent data consistent.
 *
 * Disk persistence is handled by `writeReadingHistory` / `readReadingHistory`
 * — we intentionally do not use zustand's `persist` middleware here because
 * the repository already sanitizes / clamps the data.
 */
const useReadingProgressStore = create<ReadingProgressStore>((set) => {
  // Run migration on first load
  migrateReadingHistory()
  const initial = readReadingHistory()
  syncRef(initial)
  return {
    recentReadingInfo: initial,
    setRecentReadingInfo: (items) => {
      syncRef(items)
      set({ recentReadingInfo: items })
    }
  }
})

/**
 * Backwards-compatible hook matching the previous
 * `useReadingProgressPersistence` API. Subscribers get the shared state
 * and stable action references so existing callers don't need to change.
 */
export const useReadingProgressPersistence = () => {
  const recentReadingInfo = useReadingProgressStore((s) => s.recentReadingInfo)

  return {
    recentReadingInfo,
    recentReadingInfoRef,
    getLastReadingInfo,
    getRecentReadingInfo,
    updateReadingProgress,
    upsertLastReadingInfo,
    flushPendingReadingProgress: flushPendingDebounce,
    clearLastReading,
    restoreRecentReading
  }
}

// Flush any pending debounced writes on tab/window teardown.
if (typeof window !== 'undefined') {
  const flush = () => flushPendingDebounce()
  window.addEventListener('beforeunload', flush)
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

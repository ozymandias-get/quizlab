import { useToastStore } from '@shared/stores/toastStore'

import { create } from 'zustand'

import { isSamePdfPath, normalizePdfPathKey } from '../lib/pdfPathIdentity'
import {
  MAX_RECENT_PDFS,
  migrateReadingHistory,
  readReadingHistory,
  upsertRecentHistory,
  writeReadingHistory
} from './readingHistoryRepository'
import type { LastReadingInfo, ReadingProgressUpdate } from './types'

const READING_PROGRESS_DEBOUNCE_MS = 400

interface PendingReadingProgress {
  apply: () => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Pending page writes, one per PDF path.
 *
 * A single global slot let a page change in PDF-B replace the unsaved page
 * change of PDF-A inside the 400 ms window. The key is the document path (the
 * empty string for the rare pathless update), so each document keeps its own
 * timer.
 */
const pendingReadingProgress = new Map<string, PendingReadingProgress>()

const recentReadingInfoRef: { current: LastReadingInfo[] } = { current: [] }

const clearDebounce = (): void => {
  for (const pending of pendingReadingProgress.values()) {
    clearTimeout(pending.timer)
  }
  pendingReadingProgress.clear()
}

const cancelPendingForPath = (path: string): void => {
  const key = normalizePdfPathKey(path)
  const pending = pendingReadingProgress.get(key)
  if (!pending) return
  clearTimeout(pending.timer)
  pendingReadingProgress.delete(key)
}

const flushPendingDebounce = (path?: string): void => {
  if (path !== undefined) {
    const key = normalizePdfPathKey(path)
    const pending = pendingReadingProgress.get(key)
    if (!pending) return
    pendingReadingProgress.delete(key)
    clearTimeout(pending.timer)
    pending.apply()
    return
  }

  const pending = [...pendingReadingProgress.values()]
  pendingReadingProgress.clear()
  for (const entry of pending) {
    clearTimeout(entry.timer)
    entry.apply()
  }
}

/**
 * Viewers that hold a page change inside their own debounce.
 *
 * The page state reports a turn after 300 ms so a burst of turns is one write.
 * A window that closes inside that window never gives the timer a chance to
 * run, and the store's teardown flush can only write what it has been told.
 * A source is asked once, immediately before that flush, so its pending page
 * joins the same write instead of being lost.
 */
const pendingProgressSources = new Set<() => ReadingProgressUpdate | null>()

/**
 * Registers the pending-page source of one viewer. The returned function
 * unregisters it; a viewer that unmounts must stop being asked.
 */
export const registerPendingReadingProgressSource = (
  source: () => ReadingProgressUpdate | null
): (() => void) => {
  pendingProgressSources.add(source)
  return () => {
    pendingProgressSources.delete(source)
  }
}

/**
 * Flushes every pending page.
 *
 * Sources are pulled before the debounce is drained, so a page that was still
 * waiting inside a viewer is written by the same pass that flushes the store.
 */
const flushPendingReadingProgress = (): void => {
  for (const source of pendingProgressSources) {
    let pending: ReadingProgressUpdate | null = null
    try {
      pending = source()
    } catch {
      // A viewer that cannot answer must not stop the others from flushing.
      pending = null
    }
    if (pending) updateReadingProgress(pending)
  }
  flushPendingDebounce()
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

/** Report a history write failure once, not on every debounce tick. */
let historyWriteFailureNotified = false

const persistRecentReadingInfo = (items: LastReadingInfo[]): void => {
  const saved = writeReadingHistory(items)
  syncRef(items)
  useReadingProgressStore.setState({ recentReadingInfo: items })

  if (saved) {
    historyWriteFailureNotified = false
    return
  }
  if (!historyWriteFailureNotified) {
    historyWriteFailureNotified = true
    // The in-memory list is still updated; only persistence failed. Say so
    // instead of letting the next launch silently lose the reading position.
    useToastStore.getState().showWarning('toast_pdf_history_save_failed')
  }
}

const updateReadingProgress = (update: ReadingProgressUpdate): void => {
  const { path, page, totalPages, lastOpenedAt } = update

  const doPersist = (state: LastReadingInfo[]) => {
    const existing = state.find((entry) => isSamePdfPath(entry.path, path))
    if (!existing) {
      if (!path) return
      const newEntry: LastReadingInfo = {
        path,
        name: path.replace(/^.*[/\\]/, '') || path,
        page: typeof page === 'number' ? Math.max(1, page) : 1,
        totalPages: typeof totalPages === 'number' ? Math.max(0, totalPages) : 0,
        lastOpenedAt: lastOpenedAt ?? Date.now()
      }
      persistRecentReadingInfo(upsertRecentHistory(state, newEntry))
      return
    }
    const nextInfo: LastReadingInfo = {
      ...existing,
      ...(typeof page === 'number' ? { page: Math.max(1, page) } : {}),
      ...(typeof totalPages === 'number' ? { totalPages: Math.max(0, totalPages) } : {}),
      lastOpenedAt: lastOpenedAt ?? Date.now()
    }
    persistRecentReadingInfo(upsertRecentHistory(state, nextInfo))
  }

  const shouldDebounce = typeof page === 'number' && typeof totalPages !== 'number'

  if (shouldDebounce) {
    const key = normalizePdfPathKey(path)
    const previous = pendingReadingProgress.get(key)
    if (previous) clearTimeout(previous.timer)
    const apply = () => doPersist(useReadingProgressStore.getState().recentReadingInfo)
    const timer = setTimeout(() => {
      const current = pendingReadingProgress.get(key)
      if (current?.timer !== timer) return
      pendingReadingProgress.delete(key)
      current.apply()
    }, READING_PROGRESS_DEBOUNCE_MS)
    pendingReadingProgress.set(key, { apply, timer })
    return
  }

  // A non-page write (opening a tab, switching documents) must not throw away
  // the page write that is still inside the debounce window. Apply it first,
  // then persist the newer state on top.
  flushPendingDebounce()
  doPersist(useReadingProgressStore.getState().recentReadingInfo)
}

const upsertLastReadingInfo = (info: LastReadingInfo): void => {
  const current = useReadingProgressStore.getState().recentReadingInfo
  persistRecentReadingInfo(upsertRecentHistory(current, info))
}

/**
 * Records that a PDF was opened without resetting a known reading position.
 *
 * Reopening a document from the picker, a drop or Explorer used to write the
 * default page 1 over the stored position, so the next resume started at the
 * first page even though the user had left the document at page 150. Opening
 * is not navigation: only a document with no usable entry gets the default.
 * An explicit page change still goes through `updateReadingProgress`.
 */
const recordPdfOpened = (info: { name: string; path: string; lastOpenedAt?: number }): void => {
  const current = useReadingProgressStore.getState().recentReadingInfo
  const existing = current.find((entry) => isSamePdfPath(entry.path, info.path))
  const nextInfo: LastReadingInfo = existing
    ? {
        ...existing,
        // Keep the position, but adopt the path spelling the viewer will use:
        // the tab and the history entry have to resolve to the same key when
        // the document is opened from a different surface.
        path: info.path,
        name: info.name || existing.name,
        lastOpenedAt: info.lastOpenedAt ?? Date.now()
      }
    : {
        name: info.name,
        path: info.path,
        page: 1,
        totalPages: 0,
        lastOpenedAt: info.lastOpenedAt ?? Date.now()
      }
  persistRecentReadingInfo(upsertRecentHistory(current, nextInfo))
}

const clearLastReading = (path?: string): void => {
  if (path) {
    cancelPendingForPath(path)
  } else {
    clearDebounce()
  }
  const current = useReadingProgressStore.getState().recentReadingInfo
  if (!path) {
    persistRecentReadingInfo([])
    return
  }
  persistRecentReadingInfo(current.filter((entry) => !isSamePdfPath(entry.path, path)))
}

const restoreRecentReading = (info: LastReadingInfo, index = 0): void => {
  const current = useReadingProgressStore.getState().recentReadingInfo
  const history = current.filter((entry) => !isSamePdfPath(entry.path, info.path))
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
 * from disk.
 *
 * Two callers, both outside this module. Tests use it to get a clean store.
 * Application boot uses it because the store is created by a static import and
 * therefore snapshots `readReadingHistory()` **before** `hydrateSettingsFromMain()`
 * writes the main process' copy of `STORAGE_KEYS.LAST_PDF_READING` into
 * localStorage — the same module-init ordering trap `hydratePreferenceStores()`
 * exists to correct for the appearance and language stores. Without this the
 * session starts with an empty recent list and the first progress write persists
 * that one-entry list back over the real history.
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
    recordPdfOpened,
    flushPendingReadingProgress,
    clearLastReading,
    restoreRecentReading
  }
}

// Flush any pending debounced writes on tab/window teardown.
if (typeof window !== 'undefined') {
  const flush = () => flushPendingReadingProgress()
  window.addEventListener('beforeunload', flush)
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

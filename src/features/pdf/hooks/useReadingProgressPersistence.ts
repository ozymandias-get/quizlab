import { useCallback, useRef, useEffect, useState } from 'react'
import type { LastReadingInfo, ReadingProgressUpdate } from './types'
import {
  MAX_RECENT_PDFS,
  readReadingHistory,
  upsertRecentHistory,
  writeReadingHistory
} from './readingHistoryRepository'

export const useReadingProgressPersistence = () => {
  const [recentReadingInfo, setRecentReadingInfo] = useState<LastReadingInfo[]>(() =>
    readReadingHistory()
  )
  const recentReadingInfoRef = useRef<LastReadingInfo[]>(recentReadingInfo)
  const readingProgressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingReadingProgressApplyRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    recentReadingInfoRef.current = recentReadingInfo
  }, [recentReadingInfo])

  const persistRecentReadingInfo = useCallback((items: LastReadingInfo[]) => {
    writeReadingHistory(items)
    recentReadingInfoRef.current = items
    setRecentReadingInfo(items)
  }, [])

  const getLastReadingInfo = useCallback((): LastReadingInfo | null => {
    return recentReadingInfoRef.current[0] || null
  }, [])

  const getRecentReadingInfo = useCallback((): LastReadingInfo[] => {
    return recentReadingInfoRef.current
  }, [])

  const flushPendingReadingProgress = useCallback(() => {
    if (readingProgressDebounceRef.current) {
      clearTimeout(readingProgressDebounceRef.current)
      readingProgressDebounceRef.current = null
    }
    pendingReadingProgressApplyRef.current?.()
    pendingReadingProgressApplyRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      flushPendingReadingProgress()
    }
  }, [flushPendingReadingProgress])

  const updateReadingProgress = useCallback(
    (update: ReadingProgressUpdate) => {
      const { path, page, totalPages, lastOpenedAt } = update
      const current = recentReadingInfoRef.current
      const existing = current.find((item) => item.path === path)
      if (!existing) return

      const nextInfo: LastReadingInfo = {
        ...existing,
        ...(typeof page === 'number' ? { page: Math.max(1, page) } : {}),
        ...(typeof totalPages === 'number' ? { totalPages: Math.max(0, totalPages) } : {}),
        lastOpenedAt: lastOpenedAt ?? Date.now()
      }

      const applyPersist = () => {
        persistRecentReadingInfo(upsertRecentHistory(recentReadingInfoRef.current, nextInfo))
      }

      const shouldDebounce = typeof page === 'number' && typeof totalPages !== 'number'

      if (shouldDebounce) {
        pendingReadingProgressApplyRef.current = applyPersist
        if (readingProgressDebounceRef.current) {
          clearTimeout(readingProgressDebounceRef.current)
        }
        readingProgressDebounceRef.current = setTimeout(() => {
          readingProgressDebounceRef.current = null
          pendingReadingProgressApplyRef.current?.()
          pendingReadingProgressApplyRef.current = null
        }, 400)
        return
      }

      if (readingProgressDebounceRef.current) {
        clearTimeout(readingProgressDebounceRef.current)
        readingProgressDebounceRef.current = null
      }
      pendingReadingProgressApplyRef.current?.()
      pendingReadingProgressApplyRef.current = null
      applyPersist()
    },
    [persistRecentReadingInfo]
  )

  const upsertLastReadingInfo = useCallback(
    (info: LastReadingInfo) => {
      persistRecentReadingInfo(upsertRecentHistory(recentReadingInfoRef.current, info))
    },
    [persistRecentReadingInfo]
  )

  const clearLastReading = useCallback(
    (path?: string) => {
      if (!path) {
        persistRecentReadingInfo([])
        return
      }
      const history = recentReadingInfoRef.current.filter((item) => item.path !== path)
      persistRecentReadingInfo(history)
    },
    [persistRecentReadingInfo]
  )

  const restoreRecentReading = useCallback(
    (info: LastReadingInfo, index = 0) => {
      const history = recentReadingInfoRef.current.filter((item) => item.path !== info.path)
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
    },
    [persistRecentReadingInfo]
  )

  return {
    recentReadingInfo,
    recentReadingInfoRef, // Expose ref for synchronous access if needed
    getLastReadingInfo,
    getRecentReadingInfo,
    updateReadingProgress,
    upsertLastReadingInfo,
    flushPendingReadingProgress,
    clearLastReading,
    restoreRecentReading
  }
}

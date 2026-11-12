import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useLocalStorage } from '@shared/hooks'

import { useCallback, useMemo } from 'react'

import {
  clearRecentAiWork,
  type RecentAiWorkEntry,
  removeRecentAiWork,
  sanitizeRecentAiWork
} from '../lib/recentWork'

/**
 * Reads the recent-work list from storage and keeps it in sync with writes
 * made by the send pipeline (which deliberately writes without holding React
 * state, so a background send never re-renders the provider tree).
 */
export function useRecentAiWork() {
  const [stored] = useLocalStorage<RecentAiWorkEntry[]>(STORAGE_KEYS.RECENT_AI_WORK, [])
  const recentWorks = useMemo(() => sanitizeRecentAiWork(stored), [stored])

  const remove = useCallback((id: string) => {
    removeRecentAiWork(id)
  }, [])

  const clear = useCallback(() => {
    clearRecentAiWork()
  }, [])

  return { recentWorks, removeRecentWork: remove, clearRecentWorks: clear }
}

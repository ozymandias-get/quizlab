/**
 * The history modal's search index, built in slices.
 *
 * Lowercasing every title and message in one synchronous pass freezes the modal
 * and the keystroke that started the search on a large history. This hook builds
 * the same index in bounded slices with a yield between them, and publishes it
 * only when complete: a partially built index must never produce a truncated
 * result set, so callers show their pending state instead.
 *
 * The index exists only while a search is active. Opening the history to browse
 * therefore costs no extra string memory, and clearing the query releases it.
 */
import { useEffect, useState } from 'react'

import type { ChatSession } from '../../store/apiChatSessionUtils'

/** Messages lowercased per task. A single huge session still makes progress. */
const SEARCH_INDEX_CHUNK_MESSAGES = 500

interface SearchIndexEntry {
  session: ChatSession
  title: string
  contents: string[]
}

interface UseHistorySearchIndexOptions {
  isOpen: boolean
  /** True once the debounced query is non-empty. */
  isSearchActive: boolean
  sessions: ChatSession[]
}

interface UseHistorySearchIndexResult {
  /** `null` while inactive or still building. */
  index: SearchIndexEntry[] | null
  isBuilding: boolean
}

export function useHistorySearchIndex({
  isOpen,
  isSearchActive,
  sessions
}: UseHistorySearchIndexOptions): UseHistorySearchIndexResult {
  const [index, setIndex] = useState<SearchIndexEntry[] | null>(null)
  const [isBuilding, setIsBuilding] = useState(false)

  useEffect(() => {
    if (!isOpen || !isSearchActive) {
      setIndex(null)
      setIsBuilding(false)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const entries: SearchIndexEntry[] = []
    let cursor = 0

    setIndex(null)
    setIsBuilding(true)

    const pump = () => {
      timer = null
      if (cancelled) return

      let budget = SEARCH_INDEX_CHUNK_MESSAGES
      while (cursor < sessions.length && budget > 0) {
        const session = sessions[cursor]
        cursor += 1
        budget -= session.messages.length + 1
        entries.push({
          session,
          title: session.title.toLowerCase(),
          contents: session.messages.map((message) => message.content.toLowerCase())
        })
      }

      if (cursor < sessions.length) {
        timer = setTimeout(pump, 0)
        return
      }

      setIndex(entries)
      setIsBuilding(false)
    }

    pump()

    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [isOpen, isSearchActive, sessions])

  return { index, isBuilding }
}

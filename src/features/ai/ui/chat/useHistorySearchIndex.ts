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

/**
 * Messages lowercased per task.
 *
 * The budget is spent per **message**, not per session: one huge conversation
 * must not be copied into a single task just because its session fits in the
 * loop. A session that runs out of budget resumes where it stopped on the next
 * task, and its entry is published only once all of its messages are indexed.
 */
export const SEARCH_INDEX_CHUNK_MESSAGES = 500

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
    // Cursor pair: the session being indexed and how far into its messages the
    // previous task got. Both survive across tasks.
    let sessionCursor = 0
    let messageCursor = 0
    let contents: string[] = []

    setIndex(null)
    setIsBuilding(true)

    const pump = () => {
      timer = null
      if (cancelled) return

      let budget = SEARCH_INDEX_CHUNK_MESSAGES

      while (sessionCursor < sessions.length && budget > 0) {
        const session = sessions[sessionCursor]
        const messages = session.messages

        const take = Math.min(messages.length - messageCursor, budget)
        for (let i = messageCursor; i < messageCursor + take; i++) {
          contents.push(messages[i].content.toLowerCase())
        }
        messageCursor += take
        // The session's own title costs one unit too, so empty sessions and
        // title-only work still make the loop terminate.
        budget -= take + 1

        if (messageCursor < messages.length) {
          // Out of budget mid-session: resume here on the next task.
          break
        }

        entries.push({ session, title: session.title.toLowerCase(), contents })
        sessionCursor += 1
        messageCursor = 0
        contents = []
      }

      if (sessionCursor < sessions.length) {
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

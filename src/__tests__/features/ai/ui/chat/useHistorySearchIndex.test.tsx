/**
 * The history index is built in slices, and the budget is spent per *message*.
 * A single conversation with thousands of messages must not be copied in one
 * task just because sessions are the unit that holds messages.
 */
import type { ChatSession } from '@features/ai/store/apiChatSessionUtils'

import {
  SEARCH_INDEX_CHUNK_MESSAGES,
  useHistorySearchIndex
} from '@features/ai/ui/chat/useHistorySearchIndex'

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

/** A message whose content reads are counted, so per-task work is observable. */
function countedMessage(id: string, onRead: () => void) {
  return {
    id,
    role: 'assistant',
    get content() {
      onRead()
      return `message ${id}`
    }
  }
}

function makeSession(id: string, count: number, onRead: () => void): ChatSession {
  return {
    id,
    title: id,
    messages: Array.from({ length: count }, (_, index) => countedMessage(`${id}-${index}`, onRead)),
    createdAt: 1,
    updatedAt: 1
  } as unknown as ChatSession
}

describe('useHistorySearchIndex chunking', () => {
  it('splits one huge session across tasks instead of indexing it in one', async () => {
    let reads = 0
    const sessions = [makeSession('big', 2000, () => (reads += 1))]
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useHistorySearchIndex({ isOpen: true, isSearchActive: active, sessions }),
      { initialProps: { active: false } }
    )

    act(() => rerender({ active: true }))

    // The first task must stop at the message budget even though the session is
    // far larger. Before the fix this read all 2000 messages in one task.
    expect(reads).toBe(SEARCH_INDEX_CHUNK_MESSAGES)
    expect(result.current.isBuilding).toBe(true)
    expect(result.current.index).toBe(null)

    await waitFor(() => expect(result.current.isBuilding).toBe(false))

    expect(reads).toBe(2000)
    expect(result.current.index).toHaveLength(1)
    expect(result.current.index?.[0].contents).toHaveLength(2000)
    expect(result.current.index?.[0].contents.at(-1)).toBe('message big-1999')
  })

  it('keeps session order when a session spans several tasks', async () => {
    let reads = 0
    const sessions = [
      makeSession('a', 700, () => (reads += 1)),
      makeSession('b', 3, () => (reads += 1))
    ]

    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useHistorySearchIndex({ isOpen: true, isSearchActive: active, sessions }),
      { initialProps: { active: false } }
    )

    act(() => rerender({ active: true }))
    await waitFor(() => expect(result.current.isBuilding).toBe(false))

    expect(result.current.index?.map((entry) => entry.session.id)).toEqual(['a', 'b'])
    expect(result.current.index?.[0].contents).toHaveLength(700)
    expect(result.current.index?.[1].contents).toEqual([
      'message b-0',
      'message b-1',
      'message b-2'
    ])
    expect(reads).toBe(703)
  })

  it('releases the index when the search is cleared', async () => {
    const sessions = [makeSession('a', 10, () => undefined)]
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useHistorySearchIndex({ isOpen: true, isSearchActive: active, sessions }),
      { initialProps: { active: true } }
    )

    await waitFor(() => expect(result.current.index).not.toBe(null))

    act(() => rerender({ active: false }))

    expect(result.current.index).toBe(null)
    expect(result.current.isBuilding).toBe(false)
  })
})

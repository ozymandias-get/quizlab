/**
 * Regression tests for the session-init race (P1).
 *
 * While the sessions query is loading the hook sees `[]`. That must NOT be
 * treated as "user has no sessions" — otherwise a junk session is created and
 * persisted over the real history.
 */
import { useApiChatSessionInit } from '@features/ai/hooks/useApiChatSessionInit'

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useApiChatSessionInit enabled gate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does NOT create a session while disabled (query loading)', () => {
    const create = vi.fn(async () => ({ session: { id: 'new' } }))
    const setActive = vi.fn()

    renderHook(() =>
      useApiChatSessionInit({
        tabId: 't1',
        sessions: [],
        createSessionMutation: create,
        setActiveSessionId: setActive,
        enabled: false
      })
    )

    expect(create).not.toHaveBeenCalled()
    expect(setActive).not.toHaveBeenCalled()
  })

  it('creates a session when enabled and sessions is truly empty', async () => {
    const create = vi.fn(async () => ({ session: { id: 'new-id' } }))
    const setActive = vi.fn()

    const { result } = renderHook(() =>
      useApiChatSessionInit({
        tabId: 't1',
        sessions: [],
        createSessionMutation: create,
        setActiveSessionId: setActive,
        enabled: true
      })
    )

    // Effect is async; wait a microtask.
    await new Promise((r) => setTimeout(r, 0))
    expect(create).toHaveBeenCalledTimes(1)
    // setActive is called after the promise resolves
    await new Promise((r) => setTimeout(r, 0))
    expect(setActive).toHaveBeenCalledWith('t1', 'new-id')
    void result
  })

  it('adopts the most recently updated session instead of creating', async () => {
    const create = vi.fn()
    const setActive = vi.fn()
    const sessions = [
      { id: 'old', updatedAt: 100 },
      { id: 'recent', updatedAt: 999 }
    ]

    renderHook(() =>
      useApiChatSessionInit({
        tabId: 't1',
        sessions,
        createSessionMutation: create,
        setActiveSessionId: setActive,
        enabled: true
      })
    )

    await new Promise((r) => setTimeout(r, 0))
    expect(create).not.toHaveBeenCalled()
    expect(setActive).toHaveBeenCalledWith('t1', 'recent')
  })
})

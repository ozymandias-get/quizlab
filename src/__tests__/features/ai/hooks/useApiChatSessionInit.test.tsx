import { useApiChatSessionInit } from '@features/ai/hooks/useApiChatSessionInit'

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('useApiChatSessionInit', () => {
  it('does not activate a session created for the previous tab', async () => {
    const setActiveSessionId = vi.fn()
    let resolveFirst!: (value: { session: { id: string } }) => void
    const createSessionMutation = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ session: { id: string } }>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce({ session: { id: 'session-b' } })

    const { rerender } = renderHook(
      ({ tabId }) =>
        useApiChatSessionInit({
          tabId,
          sessions: [],
          createSessionMutation,
          setActiveSessionId,
          enabled: true
        }),
      { initialProps: { tabId: 'tab-a' } }
    )

    await waitFor(() => expect(createSessionMutation).toHaveBeenCalledTimes(1))

    rerender({ tabId: 'tab-b' })
    await waitFor(() => expect(createSessionMutation).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(setActiveSessionId).toHaveBeenCalledWith('tab-b', 'session-b'))

    // The first request finishes last; it must not write to the old tab.
    await act(async () => {
      resolveFirst({ session: { id: 'session-a' } })
    })

    expect(setActiveSessionId).not.toHaveBeenCalledWith('tab-a', 'session-a')
  })

  it('does not let the previous tab request release the new tab request slot', async () => {
    const setActiveSessionId = vi.fn()
    let resolveA!: (value: { session: { id: string } }) => void
    let resolveB!: (value: { session: { id: string } }) => void
    const createSessionMutation = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ session: { id: string } }>((resolve) => {
            resolveA = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<{ session: { id: string } }>((resolve) => {
            resolveB = resolve
          })
      )

    const { rerender } = renderHook(
      ({ tabId, enabled }) =>
        useApiChatSessionInit({
          tabId,
          sessions: [],
          createSessionMutation,
          setActiveSessionId,
          enabled
        }),
      { initialProps: { tabId: 'tab-a', enabled: true } }
    )

    await waitFor(() => expect(createSessionMutation).toHaveBeenCalledTimes(1))

    rerender({ tabId: 'tab-b', enabled: true })
    await waitFor(() => expect(createSessionMutation).toHaveBeenCalledTimes(2))

    // A finishes while B is still in flight. Its finally must not release B.
    await act(async () => {
      resolveA({ session: { id: 'session-a' } })
      await Promise.resolve()
    })

    rerender({ tabId: 'tab-b', enabled: false })
    rerender({ tabId: 'tab-b', enabled: true })

    expect(createSessionMutation).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveB({ session: { id: 'session-b' } })
    })

    expect(setActiveSessionId).toHaveBeenCalledWith('tab-b', 'session-b')
    expect(setActiveSessionId).not.toHaveBeenCalledWith('tab-a', 'session-a')
  })
})

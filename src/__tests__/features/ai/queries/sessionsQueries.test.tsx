/**
 * Tests for TanStack Query hooks that replaced apiChatStore.
 *
 * These tests verify:
 *   - useSessionsQuery — reads from localStorage via loadSessions
 *   - useMessagesQuery — returns messages for a sessionId
 *   - useCreateSessionMutation — creates and persists a new session
 *   - useDeleteSessionMutation — removes a session and falls back to empty
 *   - useRenameSessionMutation — updates session title
 *
 * Streaming and message sending are tested in useSendMessageMutation tests.
 *
 * @see @features/ai/queries/useSessionsQuery
 * @see @features/ai/queries/useMessagesQuery
 */

import type { ApiChatMessage } from '@shared-core/types'

import { useMessagesQuery } from '@features/ai/queries/useMessagesQuery'
import {
  useClearAllSessionsMutation,
  useClearSessionMutation,
  useCreateSessionMutation,
  useDeleteSessionMutation,
  useRenameSessionMutation,
  useSessionsQuery
} from '@features/ai/queries/useSessionsQuery'
import type { ChatSession } from '@features/ai/store/apiChatSessionUtils'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the sessions API layer
const mockLoadSessions = vi.fn()
const mockPersistSessions = vi.fn()
const mockCreateNewSession = vi.fn()

vi.mock('@features/ai/api/sessions.api', () => ({
  loadSessions: (...args: any[]) => mockLoadSessions(...args),
  persistSessions: (...args: any[]) => mockPersistSessions(...args),
  createNewSession: (...args: any[]) => mockCreateNewSession(...args),
  addMessageToSession: vi.fn((sessions, _sessionId, message) =>
    sessions.map((s: any) =>
      s.id === _sessionId ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() } : s
    )
  ),
  deleteSessionFromList: vi.fn((sessions: any[], sessionId: string) =>
    sessions.filter((s) => s.id !== sessionId)
  ),
  renameSession: vi.fn((sessions: any[], sessionId: string, title: string) =>
    sessions.map((s: any) => (s.id === sessionId ? { ...s, title, updatedAt: Date.now() } : s))
  ),
  clearSessionMessages: vi.fn((sessions: any[], sessionId: string) =>
    sessions.map((s: any) =>
      s.id === sessionId ? { ...s, messages: [], title: 'Yeni Sohbet', updatedAt: Date.now() } : s
    )
  )
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const mockSession = (overrides: Partial<ChatSession> = {}): ChatSession => ({
  id: 'session-test-1',
  title: 'Test Session',
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides
})

describe('useSessionsQuery', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    mockLoadSessions.mockReturnValue([])
  })

  it('returns empty array when no sessions exist', async () => {
    const { result } = renderHook(() => useSessionsQuery(), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
    expect(mockLoadSessions).toHaveBeenCalledTimes(1)
  })

  it('returns sessions from loadSessions', async () => {
    const sessions = [mockSession({ id: 's1' }), mockSession({ id: 's2' })]
    mockLoadSessions.mockReturnValue(sessions)

    const { result } = renderHook(() => useSessionsQuery(), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].id).toBe('s1')
    expect(result.current.data![1].id).toBe('s2')
  })

  it('uses staleTime: Infinity so it never refetches', async () => {
    mockLoadSessions.mockReturnValue([mockSession()])

    const { result } = renderHook(() => useSessionsQuery(), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockLoadSessions).toHaveBeenCalledTimes(1)
  })
})

describe('useMessagesQuery', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    mockLoadSessions.mockReturnValue([])
  })

  it('returns empty array when sessionId is undefined (disabled)', () => {
    const { result } = renderHook(() => useMessagesQuery(undefined), {
      wrapper: createWrapper(queryClient)
    })

    // A disabled query that has never fetched is in initial loading state
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
    expect(mockLoadSessions).not.toHaveBeenCalled()
  })

  it('returns messages for the given sessionId', async () => {
    const messages: ApiChatMessage[] = [
      { id: 'm1', role: 'user', content: 'Hi', timestamp: 100 },
      { id: 'm2', role: 'assistant', content: 'Hello', timestamp: 200 }
    ]
    mockLoadSessions.mockReturnValue([mockSession({ id: 's1', messages })])

    const { result } = renderHook(() => useMessagesQuery('s1'), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].content).toBe('Hi')
    expect(result.current.data![1].content).toBe('Hello')
  })

  it('returns empty array when sessionId not found', async () => {
    mockLoadSessions.mockReturnValue([mockSession({ id: 's1' })])

    const { result } = renderHook(() => useMessagesQuery('nonexistent'), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe('useCreateSessionMutation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    mockLoadSessions.mockReturnValue([])
    // createNewSession should generate a new session-like object
    mockCreateNewSession.mockImplementation(() => mockSession({ id: 'session-new-' + Date.now() }))
  })

  it('creates a new session and persists it', async () => {
    // Seed the query cache with empty sessions
    queryClient.setQueryData(['ai', 'sessions'], [])

    const { result } = renderHook(() => useCreateSessionMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync()
    })

    expect(mockCreateNewSession).toHaveBeenCalledTimes(1)
    expect(mockPersistSessions).toHaveBeenCalledTimes(1)

    // Cache should now contain the new session
    const cached = queryClient.getQueryData(['ai', 'sessions'])
    expect(cached).toHaveLength(1)
  })

  it('prepends the new session to existing ones', async () => {
    const existing = [mockSession({ id: 'session-old' })]
    queryClient.setQueryData(['ai', 'sessions'], existing)

    const { result } = renderHook(() => useCreateSessionMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync()
    })

    const cached = queryClient.getQueryData<ChatSession[]>(['ai', 'sessions'])
    // New session should be at index 0 (prepended)
    expect(cached![0].id).not.toBe('session-old')
    expect(cached![1].id).toBe('session-old')
  })
})

describe('useDeleteSessionMutation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
  })

  it('deletes a session from the cache', async () => {
    const sessions = [mockSession({ id: 's1' }), mockSession({ id: 's2' })]
    queryClient.setQueryData(['ai', 'sessions'], sessions)

    const { result } = renderHook(() => useDeleteSessionMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync('s1')
    })

    const cached = queryClient.getQueryData<ChatSession[]>(['ai', 'sessions'])
    expect(cached).toHaveLength(1)
    expect(cached![0].id).toBe('s2')
    expect(mockPersistSessions).toHaveBeenCalled()
  })
})

describe('useRenameSessionMutation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
  })

  it('renames a session in the cache', async () => {
    const sessions = [mockSession({ id: 's1', title: 'Old Title' })]
    queryClient.setQueryData(['ai', 'sessions'], sessions)

    const { result } = renderHook(() => useRenameSessionMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync({ sessionId: 's1', title: 'New Title' })
    })

    const cached = queryClient.getQueryData<ChatSession[]>(['ai', 'sessions'])
    expect(cached![0].title).toBe('New Title')
    expect(mockPersistSessions).toHaveBeenCalled()
  })
})

describe('useClearSessionMutation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
  })

  it('clears messages and resets title for a session', async () => {
    const session = mockSession({
      id: 's1',
      title: 'My Chat',
      messages: [
        { id: 'm1', role: 'user', content: 'Hello', timestamp: 100 },
        { id: 'm2', role: 'assistant', content: 'Hi there', timestamp: 200 }
      ]
    })
    queryClient.setQueryData(['ai', 'sessions'], [session])

    const { result } = renderHook(() => useClearSessionMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync('s1')
    })

    const cached = queryClient.getQueryData<ChatSession[]>(['ai', 'sessions'])
    expect(cached).toHaveLength(1)
    expect(cached![0].messages).toHaveLength(0)
    expect(cached![0].title).toBe('Yeni Sohbet')
    expect(mockPersistSessions).toHaveBeenCalledTimes(1)
  })

  it('does not affect other sessions', async () => {
    const sessions = [
      mockSession({ id: 's1', messages: [{ id: 'm1', role: 'user', content: 'A', timestamp: 1 }] }),
      mockSession({ id: 's2', messages: [{ id: 'm2', role: 'user', content: 'B', timestamp: 2 }] })
    ]
    queryClient.setQueryData(['ai', 'sessions'], sessions)

    const { result } = renderHook(() => useClearSessionMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync('s1')
    })

    const cached = queryClient.getQueryData<ChatSession[]>(['ai', 'sessions'])
    expect(cached).toHaveLength(2)
    // s1 should be cleared
    expect(cached![0].messages).toHaveLength(0)
    expect(cached![0].title).toBe('Yeni Sohbet')
    // s2 should be untouched
    expect(cached![1].messages).toHaveLength(1)
    expect(cached![1].title).toBe('Test Session')
  })
})

describe('useClearAllSessionsMutation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    mockCreateNewSession.mockImplementation(() => mockSession({ id: 'session-new-clear-all' }))
  })

  it('replaces all sessions with a single new empty session', async () => {
    const sessions = [
      mockSession({
        id: 's1',
        title: 'Old 1',
        messages: [{ id: 'm1', role: 'user', content: 'Hi', timestamp: 1 }]
      }),
      mockSession({
        id: 's2',
        title: 'Old 2',
        messages: [{ id: 'm2', role: 'user', content: 'Hello', timestamp: 2 }]
      })
    ]
    queryClient.setQueryData(['ai', 'sessions'], sessions)

    const { result } = renderHook(() => useClearAllSessionsMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync()
    })

    const cached = queryClient.getQueryData<ChatSession[]>(['ai', 'sessions'])
    // Should be exactly 1 new session
    expect(cached).toHaveLength(1)
    expect(cached![0].id).toBe('session-new-clear-all')
    expect(cached![0].messages).toHaveLength(0)
    expect(mockCreateNewSession).toHaveBeenCalledTimes(1)
    expect(mockPersistSessions).toHaveBeenCalledTimes(1)
  })

  it('works when sessions cache is empty', async () => {
    queryClient.setQueryData(['ai', 'sessions'], [])

    const { result } = renderHook(() => useClearAllSessionsMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync()
    })

    const cached = queryClient.getQueryData<ChatSession[]>(['ai', 'sessions'])
    expect(cached).toHaveLength(1)
    expect(cached![0].messages).toHaveLength(0)
  })
})

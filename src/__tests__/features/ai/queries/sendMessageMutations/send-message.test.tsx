import { vi } from 'vitest'

import {
  createSessionsApiMock,
  mockAddMessageToSession,
  mockBuildCombinedPrompt,
  mockBuildErrorReply,
  mockSendApiChatRequest
} from './mocks'

vi.mock('@features/ai/api/sessions.api', () => createSessionsApiMock())

vi.mock('@features/ai/store/apiChatSessionUtils', async () => {
  const actual = await vi.importActual('@features/ai/store/apiChatSessionUtils')
  return {
    ...actual,
    generateId: (prefix: string) => `${prefix}-mocked`
  }
})

import type { ApiChatMessage } from '@shared-core/types'

import { useSendMessageMutation } from '@features/ai/queries/useSendMessageMutation'
import type { ChatSession } from '@features/ai/store/apiChatSessionUtils'
import { useChatUiStore } from '@features/ai/store/chatUiStore'

import { QUERY_KEYS } from '@shared/query/queryKeys'

import { QueryClient } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createWrapper,
  mockAssistantMessage,
  mockSession,
  resetChatUiStore,
  seedActiveTabSession
} from './mocks'

describe('useSendMessageMutation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    resetChatUiStore()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })

    mockAddMessageToSession.mockImplementation(
      (sessions: ChatSession[], sessionId: string, message: ApiChatMessage) =>
        sessions.map((s) =>
          s.id === sessionId
            ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
            : s
        )
    )
    mockBuildCombinedPrompt.mockReturnValue('combined prompt')
    mockBuildErrorReply.mockImplementation((err: unknown) => ({
      id: 'msg-error',
      role: 'assistant' as const,
      content: err instanceof Error ? `Hata: ${err.message}` : 'Hata: İstek başarısız oldu',
      timestamp: Date.now()
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws when no active session exists for the tab', async () => {
    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ tabId: 'tab1', text: 'Hi', images: [] })
      ).rejects.toThrow('No active session')
    })
  })

  it('optimistically adds user message to the cache before API call', async () => {
    seedActiveTabSession('tab1', 'session-1')
    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-1' })
    ])
    mockSendApiChatRequest.mockResolvedValue(mockAssistantMessage({ content: 'AI reply' }))

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync({ tabId: 'tab1', text: 'Hello!', images: [] })
    })

    const sessions = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS)
    const session = sessions?.find((s) => s.id === 'session-1')
    const userMsg = session?.messages.find((m) => m.role === 'user')
    expect(userMsg?.content).toBe('Hello!')
  })

  it('adds assistant reply to cache after API call succeeds', async () => {
    seedActiveTabSession('tab1', 'session-1')
    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-1' })
    ])
    mockSendApiChatRequest.mockResolvedValue(mockAssistantMessage({ content: 'Hello back!' }))

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      const res = await result.current.mutateAsync({ tabId: 'tab1', text: 'Hi', images: [] })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.reply.content).toBe('Hello back!')
        expect(res.sessionId).toBe('session-1')
      }
    })

    const sessions = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS)
    const session = sessions?.find((s) => s.id === 'session-1')
    const reply = session?.messages.find((m) => m.content === 'Hello back!')
    expect(reply).toBeDefined()
  })

  it('sets streaming flag true during mutation and false after completion', async () => {
    seedActiveTabSession('tab1', 'tab1-session')
    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'tab1-session' })
    ])

    let resolveRequest!: (msg: ApiChatMessage) => void
    mockSendApiChatRequest.mockReturnValue(
      new Promise<ApiChatMessage>((resolve) => {
        resolveRequest = resolve
      })
    )

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    const mutatePromise = result.current.mutateAsync({
      tabId: 'tab1',
      text: 'streaming test',
      images: []
    })

    await vi.waitFor(() => {
      expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBe(true)
    })

    await act(async () => {
      resolveRequest(mockAssistantMessage({ content: 'done' }))
      await mutatePromise
    })

    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBe(false)
  })

  it('handles API failure by adding error message and cleaning streaming state', async () => {
    seedActiveTabSession('tab1', 'session-err')
    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-err' })
    ])
    mockSendApiChatRequest.mockRejectedValue(new Error('API hatası'))

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      const res = await result.current.mutateAsync({ tabId: 'tab1', text: 'fail', images: [] })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe('API hatası')
        expect(res.errorReply?.content?.toString()).toContain('Hata')
      }
    })

    const sessions = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS)
    const session = sessions?.find((s) => s.id === 'session-err')
    const errorMsg = session?.messages.find((m) => m.content?.toString().includes('Hata'))
    expect(errorMsg).toBeDefined()
    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBe(false)
  })

  it('keeps transcript ordering valid when the API fails after user message persistence', async () => {
    seedActiveTabSession('tab1', 'session-order')
    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-order' })
    ])
    mockSendApiChatRequest.mockRejectedValue(new Error('timeout'))

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync({ tabId: 'tab1', text: 'order me', images: [] })
    })

    const session = queryClient
      .getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS)
      ?.find((s) => s.id === 'session-order')
    const roles = session?.messages.map((m) => m.role)
    const contents = session?.messages.map((m) => m.content?.toString() ?? '')
    expect(roles).toEqual(['user', 'assistant'])
    expect(contents?.[0]).toBe('order me')
    expect(contents?.[1]).toContain('Hata')
    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBe(false)
  })

  it('allows a retry after failure and persists the second reply', async () => {
    seedActiveTabSession('tab1', 'session-retry')
    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-retry' })
    ])
    mockSendApiChatRequest.mockRejectedValueOnce(new Error('network down'))
    mockSendApiChatRequest.mockResolvedValueOnce(mockAssistantMessage({ content: 'retried ok' }))

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      const first = await result.current.mutateAsync({ tabId: 'tab1', text: 'try one', images: [] })
      expect(first.success).toBe(false)
      const second = await result.current.mutateAsync({
        tabId: 'tab1',
        text: 'try two',
        images: []
      })
      expect(second.success).toBe(true)
    })

    const session = queryClient
      .getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS)
      ?.find((s) => s.id === 'session-retry')
    const contents = session?.messages.map((m) => m.content?.toString() ?? '')
    expect(contents).toContain('retried ok')
    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBe(false)
  })
})

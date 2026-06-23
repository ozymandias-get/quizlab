import { vi } from 'vitest'

import {
  mockAddMessageToSession,
  mockBuildCombinedPrompt,
  mockBuildErrorReply,
  mockPersistSessions,
  mockSendApiChatRequest
} from './mocks'

vi.mock('@features/ai/api/sessions.api', () => ({
  sendApiChatRequest: (...args: any[]) => mockSendApiChatRequest(...args),
  persistSessions: (...args: any[]) => mockPersistSessions(...args),
  addMessageToSession: (...args: any[]) => mockAddMessageToSession(...args),
  buildCombinedPrompt: (...args: any[]) => mockBuildCombinedPrompt(...args),
  buildErrorReply: (...args: any[]) => mockBuildErrorReply(...args),
  loadSessions: vi.fn(() => []),
  createNewSession: vi.fn(() => ({
    id: 'new-session',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    title: 'New Chat'
  })),
  clearSessionMessages: vi.fn((sessions: any[], _id: string) => sessions),
  renameSession: vi.fn((sessions: any[], _id: string, _title: string) => sessions),
  deleteSessionFromList: vi.fn((sessions: any[], _id: string) => sessions),
  fetchApiChatModels: vi.fn(async () => []),
  getApiChatConfig: vi.fn(async () => ({
    providers: [],
    generalPrompt: '',
    memoryPrompt: '',
    characterPrompt: '',
    selectedProviderId: '',
    selectedModel: ''
  }))
}))

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

import { createWrapper, mockAssistantMessage, mockSession, resetChatUiStore } from './mocks'

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
    useChatUiStore.setState({
      activeSessionIdByTab: { tab1: 'session-1' },
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {},
      isStreamingByTab: {}
    })
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
    useChatUiStore.setState({
      activeSessionIdByTab: { tab1: 'session-1' },
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {},
      isStreamingByTab: {}
    })
    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-1' })
    ])
    mockSendApiChatRequest.mockResolvedValue(mockAssistantMessage({ content: 'Hello back!' }))

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      const res = await result.current.mutateAsync({ tabId: 'tab1', text: 'Hi', images: [] })
      expect(res.reply.content).toBe('Hello back!')
    })
  })

  it('sets streaming flag true during mutation and false after completion', async () => {
    useChatUiStore.setState({
      activeSessionIdByTab: { tab1: 'tab1-session' },
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {},
      isStreamingByTab: {}
    })
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
    useChatUiStore.setState({
      activeSessionIdByTab: { tab1: 'session-err' },
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {},
      isStreamingByTab: {}
    })
    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-err' })
    ])
    mockSendApiChatRequest.mockRejectedValue(new Error('API hatası'))

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      const res = await result.current.mutateAsync({ tabId: 'tab1', text: 'fail', images: [] })
      expect(res.reply.content?.toString()).toContain('Hata')
    })

    const sessions = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS)
    const session = sessions?.find((s) => s.id === 'session-err')
    const errorMsg = session?.messages.find((m) => m.content?.toString().includes('Hata'))
    expect(errorMsg).toBeDefined()
    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBe(false)
  })

  it('persists sessions after mutation (success or error)', async () => {
    useChatUiStore.setState({
      activeSessionIdByTab: { tab1: 'session-persist' },
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {},
      isStreamingByTab: {}
    })
    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-persist' })
    ])
    mockSendApiChatRequest.mockResolvedValue(mockAssistantMessage({ content: 'persisted' }))

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync({ tabId: 'tab1', text: 'persist me', images: [] })
    })

    expect(mockPersistSessions).toHaveBeenCalled()
  })
})

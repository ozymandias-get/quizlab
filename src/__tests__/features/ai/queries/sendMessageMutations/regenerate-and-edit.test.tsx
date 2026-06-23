import { vi } from 'vitest'

import {
  mockAddMessageToSession,
  mockBuildCombinedPrompt,
  mockBuildErrorReply,
  mockSendApiChatRequest
} from './mocks'

vi.mock('@features/ai/api/sessions.api', () => ({
  sendApiChatRequest: (...args: any[]) => mockSendApiChatRequest(...args),
  persistSessions: vi.fn(),
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

import {
  useEditAndRegenerateMutation,
  useRegenerateMutation
} from '@features/ai/queries/useSendMessageMutation'
import type { ChatSession } from '@features/ai/store/apiChatSessionUtils'
import { useChatUiStore } from '@features/ai/store/chatUiStore'

import { QUERY_KEYS } from '@shared/query/queryKeys'

import { QueryClient } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { createWrapper, mockAssistantMessage, mockSession, resetChatUiStore } from './mocks'

describe('useRegenerateMutation', () => {
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

  it('truncates the last assistant message and regenerates a new reply', async () => {
    useChatUiStore.setState({
      activeSessionIdByTab: { tab1: 'session-rg' },
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {},
      isStreamingByTab: {}
    })

    const existingMessages: ApiChatMessage[] = [
      { id: 'u1', role: 'user', content: 'Hello', timestamp: 1000 },
      { id: 'a1', role: 'assistant', content: 'First reply', timestamp: 2000 },
      { id: 'u2', role: 'user', content: 'Tell me more', timestamp: 3000 },
      { id: 'a2', role: 'assistant', content: 'Old reply', timestamp: 4000 }
    ]

    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-rg', messages: existingMessages })
    ])
    mockSendApiChatRequest.mockResolvedValue(mockAssistantMessage({ content: 'Regenerated reply' }))

    const { result } = renderHook(() => useRegenerateMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      const res = await result.current.mutateAsync({
        tabId: 'tab1',
        messages: existingMessages
      })
      expect(res.reply.content).toBe('Regenerated reply')
    })

    const sessions = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS)
    const session = sessions?.find((s) => s.id === 'session-rg')
    const lastMsg = session?.messages[session.messages.length - 1]
    expect(lastMsg?.content).toBe('Regenerated reply')
    const oldReply = session?.messages.find((m) => m.content === 'Old reply')
    expect(oldReply).toBeUndefined()
  })

  it('resets streaming flag after regeneration completes', async () => {
    useChatUiStore.setState({
      activeSessionIdByTab: { tab1: 'session-stream' },
      isStreamingByTab: { tab1: true },
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {}
    })

    const messages: ApiChatMessage[] = [
      { id: 'u1', role: 'user', content: 'hi', timestamp: 1000 },
      { id: 'a1', role: 'assistant', content: 'hello', timestamp: 2000 }
    ]

    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-stream', messages })
    ])
    mockSendApiChatRequest.mockResolvedValue(mockAssistantMessage({ content: 'new reply' }))

    const { result } = renderHook(() => useRegenerateMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync({ tabId: 'tab1', messages })
    })

    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBe(false)
  })

  it('handles error during regeneration gracefully', async () => {
    useChatUiStore.setState({
      activeSessionIdByTab: { tab1: 'session-err' },
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {},
      isStreamingByTab: {}
    })

    const messages: ApiChatMessage[] = [
      { id: 'u1', role: 'user', content: 'do it', timestamp: 1000 },
      { id: 'a1', role: 'assistant', content: 'ok', timestamp: 2000 }
    ]

    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-err', messages })
    ])
    mockSendApiChatRequest.mockRejectedValue(new Error('API hatası'))

    const { result } = renderHook(() => useRegenerateMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      const res = await result.current.mutateAsync({ tabId: 'tab1', messages })
      expect(res.reply.content?.toString()).toContain('Hata')
    })

    const sessions = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS)
    const session = sessions?.find((s) => s.id === 'session-err')
    const errorMsg = session?.messages.find((m) => m.content?.toString().includes('Hata'))
    expect(errorMsg).toBeDefined()
  })
})

describe('useEditAndRegenerateMutation', () => {
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

  it('edits the specified user message and regenerates assistant reply', async () => {
    useChatUiStore.setState({
      activeSessionIdByTab: { tab1: 'session-er' },
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {},
      isStreamingByTab: {}
    })

    const existingMessages: ApiChatMessage[] = [
      { id: 'u1', role: 'user', content: 'Original', timestamp: 1000 },
      { id: 'a1', role: 'assistant', content: 'Reply', timestamp: 2000 }
    ]

    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-er', messages: existingMessages })
    ])
    mockSendApiChatRequest.mockResolvedValue(mockAssistantMessage({ content: 'Edited reply' }))

    const { result } = renderHook(() => useEditAndRegenerateMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      const res = await result.current.mutateAsync({
        tabId: 'tab1',
        messages: existingMessages,
        messageId: 'u1',
        newContent: 'Edited question'
      })
      expect(res.reply.content).toBe('Edited reply')
    })

    const sessions = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS)
    const session = sessions?.find((s) => s.id === 'session-er')
    const editedMsg = session?.messages.find((m) => m.id === 'u1')
    expect(editedMsg?.content).toBe('Edited question')
    expect(session?.messages.length).toBe(2)
  })

  it('cleans up streaming state after edit-and-regenerate', async () => {
    useChatUiStore.setState({
      activeSessionIdByTab: { tab1: 'session-clean' },
      isStreamingByTab: { tab1: true },
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {}
    })

    const messages: ApiChatMessage[] = [
      { id: 'u1', role: 'user', content: 'Q', timestamp: 1000 },
      { id: 'a1', role: 'assistant', content: 'A', timestamp: 2000 }
    ]

    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: 'session-clean', messages })
    ])
    mockSendApiChatRequest.mockResolvedValue(mockAssistantMessage({ content: 'Clean reply' }))

    const { result } = renderHook(() => useEditAndRegenerateMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync({
        tabId: 'tab1',
        messages,
        messageId: 'u1',
        newContent: 'Updated Q'
      })
    })

    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBe(false)
  })
})

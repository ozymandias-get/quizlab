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
import { beforeEach, describe, expect, it } from 'vitest'

import { createWrapper, mockAssistantMessage, mockSession, resetChatUiStore } from './mocks'

/**
 * Lock-lifecycle tests for sendApiChatMessage:
 *
 * Once the per-tab in-flight lock is acquired, it must be released no matter
 * where the send fails (persistence, cache write, API request), so the tab is
 * never left permanently stuck in "Send in progress".
 *
 * The lock itself is module-private, so the invariant is verified through
 * public behavior: a second send must not be rejected with "Send in progress"
 * after a failure or a success.
 */
describe('useSendMessageMutation — send lock lifecycle', () => {
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

  function seedActiveSession(sessionId: string) {
    useChatUiStore.setState({
      activeSessionIdByTab: { tab1: sessionId },
      inputValueByTab: {},
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {},
      isStreamingByTab: {},
      activeStreamingContentByTab: {}
    })
    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [
      mockSession({ id: sessionId })
    ])
  }

  it('A — releases the send lock when persistSessions throws', async () => {
    seedActiveSession('session-persist-throw')
    mockPersistSessions.mockImplementationOnce(() => {
      throw new Error('persist boom')
    })

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ tabId: 'tab1', text: 'Hi', images: [] })
      ).rejects.toThrow('persist boom')
    })

    // Streaming was never turned on because the failure happened before it.
    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBeFalsy()

    mockSendApiChatRequest.mockResolvedValueOnce(mockAssistantMessage({ content: 'second ok' }))
    await act(async () => {
      const second = await result.current.mutateAsync({
        tabId: 'tab1',
        text: 'Hi again',
        images: []
      })
      expect(second.success).toBe(true)
    })
  })

  it('B — releases the send lock when queryClient.setQueryData throws', async () => {
    seedActiveSession('session-cache-throw')
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData').mockImplementationOnce(() => {
      throw new Error('cache boom')
    })

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ tabId: 'tab1', text: 'Hi', images: [] })
      ).rejects.toThrow('cache boom')
    })

    setQueryDataSpy.mockRestore()
    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBeFalsy()

    mockSendApiChatRequest.mockResolvedValueOnce(mockAssistantMessage({ content: 'second ok' }))
    await act(async () => {
      const second = await result.current.mutateAsync({
        tabId: 'tab1',
        text: 'Hi again',
        images: []
      })
      expect(second.success).toBe(true)
    })
  })

  it('C + D — API request failure releases the lock and allows a second send', async () => {
    seedActiveSession('session-api-fail')
    mockSendApiChatRequest.mockRejectedValueOnce(new Error('API boom'))

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      const first = await result.current.mutateAsync({ tabId: 'tab1', text: 'first', images: [] })
      expect(first.success).toBe(false)
      if (!first.success) {
        expect(first.error).toBe('API boom')
      }
    })

    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBe(false)

    mockSendApiChatRequest.mockResolvedValueOnce(mockAssistantMessage({ content: 'second ok' }))
    await act(async () => {
      const second = await result.current.mutateAsync({ tabId: 'tab1', text: 'second', images: [] })
      expect(second.success).toBe(true)
    })

    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBe(false)
  })

  it('E — normal success releases the lock and cleans up streaming state', async () => {
    seedActiveSession('session-ok')
    useChatUiStore.setState({ activeStreamingContentByTab: { tab1: 'partial stream' } })
    mockSendApiChatRequest.mockResolvedValueOnce(mockAssistantMessage({ content: 'first ok' }))

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      const first = await result.current.mutateAsync({ tabId: 'tab1', text: 'first', images: [] })
      expect(first.success).toBe(true)
    })

    expect(useChatUiStore.getState().isStreamingByTab['tab1']).toBe(false)
    expect(useChatUiStore.getState().activeStreamingContentByTab['tab1']).toBe('')

    mockSendApiChatRequest.mockResolvedValueOnce(mockAssistantMessage({ content: 'second ok' }))
    await act(async () => {
      const second = await result.current.mutateAsync({ tabId: 'tab1', text: 'second', images: [] })
      expect(second.success).toBe(true)
    })
  })
})

import type { ApiChatMessage } from '@shared-core/types'

import type { ChatSession } from '@features/ai/store/apiChatSessionUtils'
import { useChatUiStore } from '@features/ai/store/chatUiStore'

import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { vi } from 'vitest'

export const mockSendApiChatRequest = vi.fn()
export const mockPersistSessions = vi.fn()
export const mockAddMessageToSession = vi.fn()
export const mockBuildCombinedPrompt = vi.fn()
export const mockBuildErrorReply = vi.fn()

/**
 * The `@features/ai/api/sessions.api` module replacement.
 *
 * Every test in this folder talks to the same six functions and only ever
 * needs them as spies, so the module shape lives here once instead of being
 * copied into each file's `vi.mock` block. Exported as a factory (rather than
 * a literal) so the hoisted `vi.mock` in the test file can call it.
 */
export function createSessionsApiMock() {
  return {
    sendApiChatRequest: (...args: unknown[]) => mockSendApiChatRequest(...args),
    persistSessions: (...args: unknown[]) => mockPersistSessions(...args),
    addMessageToSession: (...args: unknown[]) => mockAddMessageToSession(...args),
    buildCombinedPrompt: (...args: unknown[]) => mockBuildCombinedPrompt(...args),
    buildErrorReply: (...args: unknown[]) => mockBuildErrorReply(...args),
    loadSessions: vi.fn(() => []),
    createNewSession: vi.fn(() => ({
      id: 'new-session',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      title: 'New Chat'
    })),
    clearSessionMessages: vi.fn((sessions: unknown[], _id: string) => sessions),
    renameSession: vi.fn((sessions: unknown[], _id: string, _title: string) => sessions),
    deleteSessionFromList: vi.fn((sessions: unknown[], _id: string) => sessions),
    fetchApiChatModels: vi.fn(async () => []),
    getApiChatConfig: vi.fn(async () => ({
      providers: [],
      generalPrompt: '',
      memoryPrompt: '',
      characterPrompt: '',
      selectedProviderId: '',
      selectedModel: ''
    }))
  }
}

/**
 * Seeds the UI store with one active session for `tabId` and clears every
 * other per-tab bucket, so a test starts from a known-empty surface instead
 * of re-stating the whole store shape.
 */
export function seedActiveTabSession(tabId: string, sessionId: string) {
  useChatUiStore.setState({
    activeSessionIdByTab: { [tabId]: sessionId },
    inputValueByTab: {},
    attachmentsByTab: {},
    selectedModelByTab: {},
    activeProviderByTab: {},
    isStreamingByTab: {},
    activeStreamingContentByTab: {}
  })
}

export function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

export const mockAssistantMessage = (overrides: Partial<ApiChatMessage> = {}): ApiChatMessage => ({
  id: 'msg-mocked-reply',
  role: 'assistant',
  content: 'AI reply',
  timestamp: Date.now(),
  ...overrides
})

export const mockSession = (overrides: Partial<ChatSession> = {}): ChatSession => ({
  id: 'session-test-1',
  title: 'Test Session',
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides
})

export const resetChatUiStore = () => {
  useChatUiStore.setState({
    activeSessionIdByTab: {},
    inputValueByTab: {},
    attachmentsByTab: {},
    selectedModelByTab: {},
    activeProviderByTab: {},
    isStreamingByTab: {}
  })
}

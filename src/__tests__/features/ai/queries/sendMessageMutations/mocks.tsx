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

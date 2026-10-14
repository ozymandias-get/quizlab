/**
 * `sendApiChatMessage` — kullanıcı mesajı yazıldıktan sonra oluşan hatalar.
 *
 * Gönderim, kullanıcı mesajını transcript'e **önce** yazar, sonra isteği atar.
 * Yazma tamamlandıktan sonra oluşan *her* hata hedefte bir kullanıcı mesajının
 * durduğu anlamına gelir. Bu hatalar istisna olarak dışarı fırlatılırsa çağıran
 * onu "hiçbir şey olmadı" diye okur ve otomatik tekrar transcript'te ikinci bir
 * kullanıcı mesajı üretir.
 *
 * Bu dosya üç gerçeği ölçer:
 * 1. Yazma sonrası beklenmedik bir hata **fırlatılmaz**, sonuçla döner.
 * 2. Sonuç `transcriptWritten: true` taşır (teslim belirsizliğinin kanıtı).
 * 3. Temizlik (`finally`) hatası yerleşmiş sonucu **gölgelemez**.
 */
import { vi } from 'vitest'

import {
  mockAddMessageToSession,
  mockBuildCombinedPrompt,
  mockBuildErrorReply,
  mockPersistSessions,
  mockSendApiChatRequest
} from './mocks'

vi.mock('@features/ai/api/sessions.api', () => ({
  sendApiChatRequest: (...args: unknown[]) => mockSendApiChatRequest(...args),
  persistSessions: (...args: unknown[]) => mockPersistSessions(...args),
  addMessageToSession: (...args: unknown[]) => mockAddMessageToSession(...args),
  buildCombinedPrompt: (...args: unknown[]) => mockBuildCombinedPrompt(...args),
  buildErrorReply: (...args: unknown[]) => mockBuildErrorReply(...args),
  loadSessions: vi.fn(() => []),
  createNewSession: vi.fn(() => ({ id: 'new-session', messages: [], createdAt: 1, updatedAt: 1 })),
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
}))

import {
  sendApiChatMessage,
  useSendMessageMutation
} from '@features/ai/queries/useSendMessageMutation'
import type { SendApiChatResult } from '@features/ai/queries/sendMessageUtils'
import type { ChatSession } from '@features/ai/store/apiChatSessionUtils'
import { useChatUiStore } from '@features/ai/store/chatUiStore'

import { QUERY_KEYS } from '@shared/query/queryKeys'

import { QueryClient } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { createWrapper, mockSession, resetChatUiStore } from './mocks'

const TAB = 'tab1'
const SESSION = 'session-post-write'

function seedSession() {
  useChatUiStore.setState({ activeSessionIdByTab: { [TAB]: SESSION } })
  queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [mockSession({ id: SESSION })])
}

function userMessagesInTranscript(): string[] {
  const session = queryClient
    .getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS)
    ?.find((s) => s.id === SESSION)
  return (session?.messages ?? []).filter((m) => m.role === 'user').map((m) => String(m.content))
}

let queryClient: QueryClient

describe('sendApiChatMessage — failures after the transcript write', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChatUiStore()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    mockAddMessageToSession.mockImplementation(
      (sessions: ChatSession[], sessionId: string, message: { role: string; content: string }) =>
        sessions.map((s) =>
          s.id === sessionId ? { ...s, messages: [...s.messages, message as never] } : s
        )
    )
    mockBuildCombinedPrompt.mockReturnValue('combined prompt')
    mockBuildErrorReply.mockImplementation(() => ({
      id: 'msg-error',
      role: 'assistant' as const,
      content: 'Hata',
      timestamp: Date.now()
    }))
    seedSession()
  })

  it('resolves instead of rejecting when an exception follows the transcript write', async () => {
    // Mesaj transcript'e yazıldıktan sonra (prompt birleştirme sırasında)
    // beklenmedik bir hata oluşuyor.
    mockBuildCombinedPrompt.mockImplementationOnce(() => {
      throw new Error('prompt assembly failed')
    })

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })
    const mutateSend = () => result.current.mutateAsync({ tabId: TAB, text: 'hi', images: [] })

    // Kutu, `act` içinde atanan değerin tipten daraltılmasını önler.
    const captured: { outcome?: SendApiChatResult } = {}
    await act(async () => {
      // Reject **olmamalı**: dışarı fırlayan bir istisna "hiçbir şey olmadı"
      // diye okunur ve otomatik tekrarın açılmasına yol açar.
      captured.outcome = await mutateSend()
    })

    expect(captured.outcome?.success).toBe(false)
    // Kanıt: kullanıcı mesajı transcript'e girdi.
    expect(userMessagesInTranscript()).toEqual(['hi'])
    if (!captured.outcome || captured.outcome.success) throw new Error('expected a failure')
    expect(captured.outcome.transcriptWritten).toBe(true)
  })

  it('keeps the composer cleared and releases the lock after such an exception', async () => {
    mockBuildCombinedPrompt.mockImplementationOnce(() => {
      throw new Error('prompt assembly failed')
    })

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await result.current.mutateAsync({ tabId: TAB, text: 'hi', images: [] })
    })

    expect(useChatUiStore.getState().inputValueByTab[TAB] ?? '').toBe('')
    // Kilit serbest bırakıldı: ikinci bir gönderim "Send in progress" almaz.
    mockBuildCombinedPrompt.mockReturnValue('combined prompt')
    mockSendApiChatRequest.mockResolvedValue({
      id: 'r',
      role: 'assistant',
      content: 'ok',
      timestamp: Date.now()
    })

    await act(async () => {
      const second = await result.current.mutateAsync({ tabId: TAB, text: 'again', images: [] })
      expect(second.success).toBe(true)
    })
  })

  it('reports transcriptWritten when the durable write itself fails', async () => {
    // Kalıcı yazma başladığında mesaj depoya yazılmış olabilir; bu yüzden
    // "not_started" denemek dürüst olmaz.
    mockPersistSessions.mockImplementationOnce(() => {
      throw new Error('storage quota exceeded')
    })

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })
    void result

    const captured: { outcome?: SendApiChatResult } = {}
    await act(async () => {
      captured.outcome = await sendApiChatMessage(queryClient, {
        tabId: TAB,
        text: 'hi',
        images: []
      })
    })

    expect(captured.outcome?.success).toBe(false)
    if (!captured.outcome || captured.outcome.success) throw new Error('expected a failure')
    expect(captured.outcome.transcriptWritten).toBe(true)
  })

  it('still rejects pre-flight failures, because nothing was written', async () => {
    useChatUiStore.setState({ activeSessionIdByTab: {} })

    const { result } = renderHook(() => useSendMessageMutation(), {
      wrapper: createWrapper(queryClient)
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ tabId: TAB, text: 'hi', images: [] })
      ).rejects.toThrow('No active session')
    })
    expect(userMessagesInTranscript()).toEqual([])
  })
})

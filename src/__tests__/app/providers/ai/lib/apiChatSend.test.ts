import { beforeEach, describe, expect, it, vi } from 'vitest'

const { uiStateMock, sendApiChatMessageMock } = vi.hoisted(() => ({
  uiStateMock: { value: {} as Record<string, any> },
  sendApiChatMessageMock: vi.fn()
}))

vi.mock('@app/providers/queryClient', () => ({
  queryClient: {}
}))

vi.mock('@features/ai/queries/useSendMessageMutation', () => ({
  sendApiChatMessage: sendApiChatMessageMock
}))

vi.mock('@features/ai/store/chatUiStore', () => ({
  useChatUiStore: { getState: () => uiStateMock.value }
}))

import { flushApiChatSend, scheduleApiChatSend } from '@app/providers/ai/lib/apiChatSend'

const baseUiState = () => ({
  inputValueByTab: { tab1: 'hello' },
  attachmentsByTab: { tab1: [] },
  selectedModelByTab: { tab1: 'gpt-4' },
  activeProviderByTab: { tab1: 'provider-1' },
  generalPrompt: '',
  memoryPrompt: '',
  characterPrompt: ''
})

describe('flushApiChatSend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uiStateMock.value = baseUiState()
  })

  it('returns success true when the API send succeeds', async () => {
    sendApiChatMessageMock.mockResolvedValue({
      success: true,
      reply: { id: 'r1', role: 'assistant', content: 'ok', timestamp: 1 },
      sessionId: 'session-1'
    })

    // `applied`: içerik hedefe tam olarak yerleşti.
    await expect(flushApiChatSend('tab1')).resolves.toEqual({ success: true, stage: 'applied' })
    expect(sendApiChatMessageMock).toHaveBeenCalledTimes(1)
  })

  it('returns success false with the error when the API send fails', async () => {
    sendApiChatMessageMock.mockResolvedValue({
      success: false,
      error: 'API error: 500',
      errorReply: {
        id: 'e1',
        role: 'assistant',
        content: 'Hata: API error: 500',
        timestamp: 1
      },
      sessionId: 'session-1'
    })

    // `uncertain`: `sendApiChatMessage` kullanıcı mesajını istekten **önce**
    // transcript'e yazdığı için hedefte bizim içeriğimiz duruyor. Bu aşamada
    // otomatik tekrar mükerrer mesaj üretir.
    await expect(flushApiChatSend('tab1')).resolves.toEqual({
      success: false,
      error: 'API error: 500',
      stage: 'uncertain'
    })
  })

  it('returns empty_message without calling the API for an empty composer', async () => {
    uiStateMock.value = { ...baseUiState(), inputValueByTab: {}, attachmentsByTab: {} }

    await expect(flushApiChatSend('tab1')).resolves.toEqual({
      success: false,
      error: 'empty_message',
      stage: 'not_started'
    })
    expect(sendApiChatMessageMock).not.toHaveBeenCalled()
  })

  it('returns the thrown error when sendApiChatMessage rejects', async () => {
    sendApiChatMessageMock.mockRejectedValue(new Error('No active session'))

    // `sendApiChatMessage` yalnızca **ön uçuş** hatalarında throw eder
    // (boş mesaj / oturum yok / eşzamanlı gönderim); hepsi transcript'e
    // yazılmadan önce oluşur. Bu yüzden `not_started` dürüst bir aşamadır ve
    // otomatik tekrar güvenlidir.
    await expect(flushApiChatSend('tab1')).resolves.toEqual({
      success: false,
      error: 'No active session',
      stage: 'not_started'
    })
  })
})

describe('scheduleApiChatSend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uiStateMock.value = baseUiState()
  })

  it('resolves with the actual flush outcome on failure', async () => {
    sendApiChatMessageMock.mockResolvedValue({
      success: false,
      error: 'API error: 429',
      errorReply: { id: 'e1', role: 'assistant', content: 'Hata', timestamp: 1 },
      sessionId: 'session-1'
    })
    const timeoutRef: { current: ReturnType<typeof setTimeout> | null } = { current: null }

    await expect(scheduleApiChatSend('tab1', timeoutRef)).resolves.toEqual({
      success: false,
      error: 'API error: 429',
      stage: 'uncertain'
    })
  })

  it('resolves with the actual flush outcome on success and calls onResult', async () => {
    sendApiChatMessageMock.mockResolvedValue({
      success: true,
      reply: { id: 'r1', role: 'assistant', content: 'ok', timestamp: 1 },
      sessionId: 'session-1'
    })
    const onResult = vi.fn()
    const timeoutRef: { current: ReturnType<typeof setTimeout> | null } = { current: null }

    await expect(scheduleApiChatSend('tab1', timeoutRef, onResult)).resolves.toEqual({
      success: true,
      stage: 'applied'
    })
    // Bekleyen her çağıran **kendi sekmesinin sonucunu** öğrenir; aşama taşınır.
    expect(onResult).toHaveBeenCalledWith({ success: true, stage: 'applied' })
  })
})

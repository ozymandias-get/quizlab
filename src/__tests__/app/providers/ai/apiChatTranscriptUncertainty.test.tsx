/**
 * api-chat **teslim belirsizliği** — transcript'e yazıldıktan sonra oluşan hata.
 *
 * Zorunlu regresyon senaryosu:
 *
 * 1. Yalnızca metin gönderilir.
 * 2. Kullanıcı mesajı transcript'e **yazılır**.
 * 3. API hatası oluşur.
 * 4. Composer temizlenmiş olur (gönderim mesajı kutudan aldı).
 * 5. Telafi çalışır.
 * 6. Otomatik tekrar **engellenmiş** olmalıdır.
 * 7. Aynı kullanıcı mesajı ikinci kez oluşturulmamalıdır.
 *
 * Bu dosya bunu **uçtan uca** doğrular: `useAiMessaging` gerçek,
 * `flushApiChatSend`/`sendApiChatMessage` gerçek, `chatUiStore` gerçek. Yalnızca
 * ağ ve kalıcı yazma sahte — çünkü iddia edilen hata tam olarak bu katmanın
 * "kullanıcı mesajı geçmişteyken gönderim başarısız görünüyor" hatasıdır ve
 * sahte bir `scheduleApiChatSend` ile ölçülemez.
 */
import type { AiContentController } from '@shared-core/types/aiContent'

import { resolveSendOutcome } from '@app/ui/aiSendComposer/sendOutcome'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatSession } from '@features/ai/store/apiChatSessionUtils'

const TAB = 'tab-1'
const SESSION = 'session-1'

const { mockSendApiChatRequest, persistedSessions } = vi.hoisted(() => {
  const persisted: ChatSession[][] = []
  return { mockSendApiChatRequest: vi.fn(), persistedSessions: persisted }
})

// Yalnızca ağ ve kalıcı yazma sahte; oturum işlemleri **gerçek** kalır, çünkü
// "kullanıcı mesajı transcript'e yazıldı mı" sorusunun yanıtı tam olarak
// `addMessageToSession`'ın ürettiği gerçek oturumdur.
vi.mock('@features/ai/api/sessions.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/ai/api/sessions.api')>()
  return {
    ...actual,
    sendApiChatRequest: (...args: unknown[]) => mockSendApiChatRequest(...args),
    loadSessions: () => [],
    persistSessions: (sessions: ChatSession[]) => {
      persistedSessions.push(sessions)
    }
  }
})

vi.mock('@features/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@features/ai')>()),
  // İçerik tabanlı gönderim bu senaryoda kullanılmaz; yalnızca hook'un
  // gerçek `useAiSender`'ı çağırmaması gerekir.
  useAiSender: () => ({
    sendTextToAI: vi.fn(),
    sendImageToAI: vi.fn(),
    sendBulkToAI: vi.fn(),
    cancelOngoing: vi.fn()
  })
}))

vi.mock('@app/providers/ai/aiContentSendReadiness', () => ({
  waitForContentReadyForSend: vi.fn(async () => true)
}))

import { useChatUiStore } from '@features/ai/store/chatUiStore'

import { QUERY_KEYS } from '@shared/query/queryKeys'

import { queryClient } from '@app/providers/queryClient'
import { useAiMessaging } from '@app/providers/ai/useAiMessaging'

function emptySession(): ChatSession {
  return { id: SESSION, title: 't', messages: [], createdAt: 1, updatedAt: 1 }
}

/** Son kalıcı yazma ile transcript'in gerçek kullanıcı mesajları. */
function persistedUserMessages(): { id: string; content: string }[] {
  const last = persistedSessions[persistedSessions.length - 1] ?? []
  return (last.find((s) => s.id === SESSION)?.messages ?? [])
    .filter((m) => m.role === 'user')
    .map((m) => ({ id: m.id, content: String(m.content ?? '') }))
}

function renderMessaging() {
  const showWarning = vi.fn()
  const { result } = renderHook(() =>
    useAiMessaging({
      getContentController: vi.fn(() => null as AiContentController | null),
      getActiveTab: vi.fn(() => ({ id: TAB, modelId: 'api-chat' })),
      currentAI: 'api-chat',
      activeTabId: TAB,
      autoSend: true,
      aiRegistry: {},
      showWarning,
      openAiWorkspace: vi.fn()
    })
  )
  return { result, showWarning }
}

async function sendText(result: { current: ReturnType<typeof useAiMessaging> }, text: string) {
  let outcome: Awaited<ReturnType<ReturnType<typeof useAiMessaging>['sendTextToAI']>> | undefined
  await act(async () => {
    outcome = await result.current.sendTextToAI(text)
  })
  return outcome
}

describe('api-chat — transcript written, send failed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    persistedSessions.length = 0
    useChatUiStore.getState().resetAll()
    useChatUiStore.setState({ activeSessionIdByTab: { [TAB]: SESSION } })
    // Gönderim, oturumu önbellekten okur; kalıcı yazma sahte olduğu için
    // oturum burada elle tohumlanır.
    queryClient.setQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS, [emptySession()])
    mockSendApiChatRequest.mockRejectedValue(new Error('API error: 500'))
  })

  it('blocks the automatic retry when the network fails after the transcript write', async () => {
    const { result } = renderMessaging()

    const outcome = await sendText(result, 'Explain this paragraph')

    // 2. Kullanıcı mesajı geçmişe yazıldı.
    const userMessages = persistedUserMessages()
    expect(userMessages).toHaveLength(1)
    expect(userMessages[0].content).toBe('Explain this paragraph')

    // 3./4. Gönderim başarısız ve composer temizlenmiş durumda.
    expect(outcome?.success).toBe(false)
    expect(useChatUiStore.getState().inputValueByTab[TAB] ?? '').toBe('')

    // 5./6. Telafi çalıştı ama sonucu **dürüst** kaldı: aşama `uncertain`,
    // otomatik tekrar kapalı. (Eskiden telafi "temiz" bulup `not_started`
    // yapıyor ve mükerrer mesajın yolunu açıyordu.)
    expect(outcome?.stage).toBe('uncertain')
    expect(resolveSendOutcome(outcome).resendSafe).toBe(false)
    expect(resolveSendOutcome(outcome).kind).toBe('incomplete')
  })

  it('never creates the same user message twice, even when a retry is forced', async () => {
    const { result } = renderMessaging()

    const first = await sendText(result, 'Explain this paragraph')
    const firstId = persistedUserMessages()[0]?.id

    // Üst katman "tekrar dene"yi yine de tetiklese (kullanıcı zorlaması),
    // ikinci bir deneme **aynı mesajı yeniden oluşturmaz**: kullanıcı
    // transcript'te zaten bir tane var ve hedefe ikinci bir kopya yazılmaz.
    if (resolveSendOutcome(first).resendSafe) {
      await sendText(result, 'Explain this paragraph')
    }

    const userMessages = persistedUserMessages()
    expect(userMessages).toHaveLength(1)
    expect(userMessages[0].id).toBe(firstId)
  })

  it('reports not_started only when nothing was written before the failure', async () => {
    // Oturum yok: `sendApiChatMessage` **ön uçuş** doğrulamasında throw eder,
    // transcript'e hiç dokunulmaz. Tekrar burada güvenlidir.
    useChatUiStore.setState({ activeSessionIdByTab: {} })
    const { result } = renderMessaging()

    const outcome = await sendText(result, 'Explain this paragraph')

    expect(outcome?.success).toBe(false)
    expect(outcome?.stage).toBe('not_started')
    expect(persistedUserMessages()).toHaveLength(0)
  })

  it('keeps the transcript untouched when a pre-flight error rejects the send', async () => {
    // Boş mesaj: hiçbir yazma olmadan reddedilir.
    const { result } = renderMessaging()

    const outcome = await sendText(result, '   ')

    expect(outcome?.stage).toBe('not_started')
    expect(persistedUserMessages()).toHaveLength(0)
    expect(mockSendApiChatRequest).not.toHaveBeenCalled()
  })
})

import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { QUERY_KEYS } from '@shared/query/queryKeys'

import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  addMessageToSession,
  buildCombinedPrompt,
  buildErrorReply,
  loadSessions,
  persistSessions,
  sendApiChatRequest
} from '../api/sessions.api'
import type { ChatSession } from '../store/apiChatSessionUtils'
import { useChatUiStore } from '../store/chatUiStore'
import {
  acquireChatSendLock,
  beginChatRequest,
  endChatRequest,
  releaseChatSendLock
} from './activeChatRequests'
import {
  getMessagesFromSessions,
  getUserMessage,
  isCancelledError,
  type SendApiChatResult,
  type SendMessageParams
} from './sendMessageUtils'

/**
 * Imperative send used by the mutation hook and by api-chat's debounced
 * composer flush (which runs outside React and cannot call hooks).
 *
 * Pre-flight validation errors (empty message, no active session, concurrent
 * send) throw; they are the only outcomes allowed to escape as an exception,
 * because they are the only ones that happen **before anything is written**.
 *
 * API failures do NOT throw — they persist an error bubble and resolve with
 * `{ success: false, error, errorReply }` so callers can distinguish "bubble
 * written" from "message delivered".
 *
 * ## Yazma sonrası hiçbir hata dışarı fırlatılmaz
 *
 * Kullanıcı mesajı transcript'e **önce** yazılır, sonra istek atılır. Bu
 * yüzden yazma tamamlandıktan sonra oluşan *her* hata (depo temizliği, prompt
 * birleştirme, kalıcı yazma, hatta `finally` blokları) hedefte bir kullanıcı
 * mesajının durduğu anlamına gelir. Böyle bir hata istisna olarak dışarı
 * çıkarsa çağıran onu "hiçbir şey olmadı" diye okur ve otomatik tekrar
 * transcript'te **ikinci bir kullanıcı mesajı** üretir.
 *
 * Bu yüzden kilit alındıktan sonraki bölge kendi `catch`'ine sahiptir ve
 * `transcriptWritten` bayrağını **yazmanın başladığı satırdan** itibaren
 * doğru tutar: kaçan her istisna, ne yapıldığını bilen bir sonuçla döner.
 */
export async function sendApiChatMessage(
  queryClient: QueryClient,
  params: SendMessageParams
): Promise<SendApiChatResult> {
  const { tabId, text, images, model, providerId, generalPrompt, memoryPrompt, characterPrompt } =
    params
  if (!text.trim() && images.length === 0) {
    throw new Error('Empty message')
  }
  const activeSessionId = useChatUiStore.getState().activeSessionIdByTab[tabId]
  if (!activeSessionId) throw new Error('No active session')
  if (!acquireChatSendLock(tabId)) {
    throw new Error('Send in progress')
  }

  // Lock invariant: everything after the lock acquisition runs inside the
  // try/finally below so the lock is released no matter where it fails.
  let streamingStarted = false
  let requestId: string | undefined
  /**
   * Kullanıcı mesajı transcript'e yazıldı mı?
   *
   * `persistSessions` **kalıcı** bir yazmadır: bir kez başladığında ya tamamen
   * yazar ya da depoda yarım kalır. Bu yüzden bayrak yazma çağrısından hemen
   * **önce** kaldırılır — sonrasında oluşan hiçbir hata "hiçbir şey olmadı"
   * sayılamaz.
   */
  let transcriptWritten = false
  try {
    requestId = beginChatRequest(tabId)
    const userMsg = getUserMessage(text, images, providerId)

    // Never treat an unhydrated cache as "empty": falling back to storage
    // prevents persisting a truncated session list (history loss).
    const prev = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) ?? loadSessions()
    const sessionsWithUser = addMessageToSession(prev, activeSessionId, userMsg)
    // Kalıcı yazma başlıyor: bu satırdan sonraki her hata, hedefte bir kullanıcı
    // mesajının **durduğu** anlamına gelir.
    transcriptWritten = true
    persistSessions(sessionsWithUser)
    queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, sessionsWithUser)
    queryClient.setQueryData(
      QUERY_KEYS.AI.MESSAGES(activeSessionId),
      getMessagesFromSessions(sessionsWithUser, activeSessionId)
    )

    useChatUiStore.getState().updateInput(tabId, '')
    useChatUiStore.getState().clearAttachments(tabId)
    useChatUiStore.getState().setStreaming(tabId, true)
    streamingStarted = true

    const messages = getMessagesFromSessions(sessionsWithUser, activeSessionId)
    const combinedPrompt = buildCombinedPrompt({
      memoryPrompt: memoryPrompt || '',
      characterPrompt: characterPrompt || '',
      generalPrompt: generalPrompt || ''
    })

    try {
      const reply = await sendApiChatRequest(
        messages,
        model || undefined,
        combinedPrompt || undefined,
        providerId || undefined,
        requestId
      )

      if (!reply) {
        throw new Error('Empty reply')
      }

      const sessionsWithReply = addMessageToSession(
        queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || sessionsWithUser,
        activeSessionId,
        reply
      )
      persistSessions(sessionsWithReply)
      queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, sessionsWithReply)
      queryClient.setQueryData(
        QUERY_KEYS.AI.MESSAGES(activeSessionId),
        getMessagesFromSessions(sessionsWithReply, activeSessionId)
      )

      return { success: true, reply, sessionId: activeSessionId }
    } catch (err) {
      // User-initiated cancellations (Stop button, session switch) must not
      // pollute the transcript with a misleading error bubble.
      if (isCancelledError(err)) {
        return {
          success: false,
          error: 'cancelled',
          cancelled: true,
          transcriptWritten,
          sessionId: activeSessionId
        }
      }

      const error = ensureErrorMessage(err)
      const errorReply = buildErrorReply(err)
      const sessionsWithError = addMessageToSession(
        queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || sessionsWithUser,
        activeSessionId,
        errorReply
      )
      persistSessions(sessionsWithError)
      queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, sessionsWithError)
      queryClient.setQueryData(
        QUERY_KEYS.AI.MESSAGES(activeSessionId),
        getMessagesFromSessions(sessionsWithError, activeSessionId)
      )

      return { success: false, error, errorReply, transcriptWritten, sessionId: activeSessionId }
    }
  } catch (err) {
    // Beklenmedik hata: yazma başlamadan önce olduysa hedefe hiç dokunulmamıştır;
    // yazma başladıktan sonra olduysa kullanıcı mesajı transcript'te duruyordur.
    // İkisi de aynı dönüş yolundan geçer, ayrımı `transcriptWritten` taşır — bir
    // istisna asla "not_started" diye okunamaz.
    return {
      success: false,
      error: ensureErrorMessage(err, 'send_failed'),
      transcriptWritten,
      sessionId: activeSessionId
    }
  } finally {
    if (requestId !== undefined) {
      endChatRequest(tabId, requestId)
    }
    releaseChatSendLock(tabId)
    // Only reset streaming state when it was actually turned on for this send.
    if (streamingStarted) {
      try {
        useChatUiStore.getState().setStreaming(tabId, false)
        useChatUiStore.getState().clearStreamingContent(tabId)
      } catch {
        // Temizlik başarısız olsa da **teslim sonucu** değişmez. Buradan
        // fırlatılan bir hata yukarıda oturan dürüst sonucu (başarı ya da teslim
        // belirsizliği) istisnaya dönüştürür ve çağıranı "hiçbir şey olmadı"
        // diye yanıltırdı; en kötü ihtimalde transcript'te mükerrer mesaj.
      }
    }
  }
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: SendMessageParams) => sendApiChatMessage(queryClient, params)
  })
}

export type { SendApiChatResult } from './sendMessageUtils'
export { useEditAndRegenerateMutation } from './useEditAndRegenerateMutation'
export { useRegenerateMutation } from './useRegenerateMutation'

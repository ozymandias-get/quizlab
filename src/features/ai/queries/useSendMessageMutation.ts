import { QUERY_KEYS } from '@shared/query/queryKeys'

import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  addMessageToSession,
  buildCombinedPrompt,
  buildErrorReply,
  persistSessions,
  sendApiChatRequest
} from '../api/sessions.api'
import type { ChatSession } from '../store/apiChatSessionUtils'
import { useChatUiStore } from '../store/chatUiStore'
import {
  getMessagesFromSessions,
  getUserMessage,
  type SendApiChatResult,
  type SendMessageParams
} from './sendMessageUtils'

// Serializes concurrent sends per tab: the previous send's streaming flag is
// still true until its reply lands, so a second send would read-modify-write
// the same session concurrently and corrupt the transcript order.
const inFlightSendsByTab = new Set<string>()

/**
 * Imperative send used by the mutation hook and by api-chat's debounced
 * composer flush (which runs outside React and cannot call hooks).
 *
 * Pre-flight validation errors (empty message, no active session, concurrent
 * send) throw; API failures do NOT throw — they persist an error bubble and
 * resolve with `{ success: false, error, errorReply }` so callers can
 * distinguish "bubble written" from "message delivered".
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
  if (inFlightSendsByTab.has(tabId)) {
    throw new Error('Send in progress')
  }
  inFlightSendsByTab.add(tabId)

  // Lock invariant: everything after the lock acquisition runs inside the
  // try/finally below so the lock is released no matter where it fails.
  let streamingStarted = false
  try {
    const userMsg = getUserMessage(text, images, providerId)

    const prev = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || []
    const sessionsWithUser = addMessageToSession(prev, activeSessionId, userMsg)
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
        providerId || undefined
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
      const error = err instanceof Error ? err.message : String(err)
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

      return { success: false, error, errorReply, sessionId: activeSessionId }
    }
  } finally {
    inFlightSendsByTab.delete(tabId)
    // Only reset streaming state when it was actually turned on for this send.
    if (streamingStarted) {
      useChatUiStore.getState().setStreaming(tabId, false)
      useChatUiStore.getState().clearStreamingContent(tabId)
    }
  }
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: SendMessageParams) => sendApiChatMessage(queryClient, params)
  })
}

export type {
  EditAndRegenerateParams,
  RegenerateParams,
  SendApiChatResult
} from './sendMessageUtils'
export { useEditAndRegenerateMutation } from './useEditAndRegenerateMutation'
export { useRegenerateMutation } from './useRegenerateMutation'

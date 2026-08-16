import type { ApiChatMessage } from '@shared-core/types'

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
import { getMessagesFromSessions, getUserMessage, type SendMessageParams } from './sendMessageUtils'

// Serializes concurrent sends per tab: the previous send's streaming flag is
// still true until its reply lands, so a second send would read-modify-write
// the same session concurrently and corrupt the transcript order.
const inFlightSendsByTab = new Set<string>()

/**
 * Imperative send used by the mutation hook and by api-chat's debounced
 * composer flush (which runs outside React and cannot call hooks).
 */
export async function sendApiChatMessage(
  queryClient: QueryClient,
  params: SendMessageParams
): Promise<{ reply: ApiChatMessage; sessionId: string }> {
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

  const userMsg = getUserMessage(text, images, providerId)

  const prev = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || []
  let sessionsWithUser = addMessageToSession(prev, activeSessionId, userMsg)
  persistSessions(sessionsWithUser)
  queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, sessionsWithUser)
  queryClient.setQueryData(
    QUERY_KEYS.AI.MESSAGES(activeSessionId),
    getMessagesFromSessions(sessionsWithUser, activeSessionId)
  )

  useChatUiStore.getState().updateInput(tabId, '')
  useChatUiStore.getState().clearAttachments(tabId)
  useChatUiStore.getState().setStreaming(tabId, true)

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

    return { reply, sessionId: activeSessionId }
  } catch (err) {
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

    return { reply: errorReply, sessionId: activeSessionId }
  } finally {
    inFlightSendsByTab.delete(tabId)
    useChatUiStore.getState().setStreaming(tabId, false)
    useChatUiStore.getState().clearStreamingContent(tabId)
  }
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: SendMessageParams) => sendApiChatMessage(queryClient, params)
  })
}

export type { EditAndRegenerateParams, RegenerateParams } from './sendMessageUtils'
export { useEditAndRegenerateMutation } from './useEditAndRegenerateMutation'
export { useRegenerateMutation } from './useRegenerateMutation'

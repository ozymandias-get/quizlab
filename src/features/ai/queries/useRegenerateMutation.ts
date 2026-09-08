import { QUERY_KEYS } from '@shared/query/queryKeys'

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
  isCancelledError,
  type RegenerateParams
} from './sendMessageUtils'

export { type RegenerateParams } from './sendMessageUtils'

export function useRegenerateMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: RegenerateParams) => {
      const { tabId, messages, model, providerId, generalPrompt, memoryPrompt, characterPrompt } =
        params
      const activeSessionId = useChatUiStore.getState().activeSessionIdByTab[tabId]
      if (!activeSessionId) throw new Error('No active session')
      // Shares the per-tab send lock with plain sends and edits: without it
      // a rapid Regenerate (or Send+Regenerate) would run two requests in
      // parallel and corrupt the transcript order. Callers already swallow
      // this pre-flight error (see handleRegenerateMessage).
      // The lock is acquired before the try/finally below and every path
      // after acquisition runs inside it, so a pre-try throw can never leak
      // a permanently locked tab.
      if (!acquireChatSendLock(tabId)) {
        throw new Error('Send in progress')
      }

      let requestId: string | undefined
      try {
        let truncatedMessages = [...messages]
        if (truncatedMessages[truncatedMessages.length - 1]?.role === 'assistant') {
          truncatedMessages.pop()
        }

        const prev =
          queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) ?? loadSessions()
        const sessionsWithTrunc = prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messages: truncatedMessages, updatedAt: Date.now() }
            : s
        )
        persistSessions(sessionsWithTrunc)
        queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, sessionsWithTrunc)
        queryClient.setQueryData(QUERY_KEYS.AI.MESSAGES(activeSessionId), truncatedMessages)

        useChatUiStore.getState().setStreaming(tabId, true)
        requestId = beginChatRequest(tabId)

        const combinedPrompt = buildCombinedPrompt({
          memoryPrompt: memoryPrompt || '',
          characterPrompt: characterPrompt || '',
          generalPrompt: generalPrompt || ''
        })

        try {
          const reply = await sendApiChatRequest(
            truncatedMessages,
            model || undefined,
            combinedPrompt || undefined,
            providerId || undefined,
            requestId
          )

          if (!reply) {
            throw new Error('Empty reply')
          }

          const sessionsWithReply = addMessageToSession(
            queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || sessionsWithTrunc,
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
          // A user-initiated cancel (Stop button) must not write an error bubble.
          if (!isCancelledError(err)) {
            const errorReply = buildErrorReply(err)
            const sessionsWithError = addMessageToSession(
              queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || sessionsWithTrunc,
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
          }

          return { reply: null, sessionId: activeSessionId }
        }
      } finally {
        if (requestId !== undefined) {
          endChatRequest(tabId, requestId)
        }
        releaseChatSendLock(tabId)
        useChatUiStore.getState().setStreaming(tabId, false)
        useChatUiStore.getState().clearStreamingContent(tabId)
      }
    }
  })
}

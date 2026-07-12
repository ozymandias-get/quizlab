import type { ApiChatMessage } from '@shared-core/types'

import { QUERY_KEYS } from '@shared/query/queryKeys'

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
import { type EditAndRegenerateParams, getMessagesFromSessions } from './sendMessageUtils'

export { type EditAndRegenerateParams } from './sendMessageUtils'

export function useEditAndRegenerateMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: EditAndRegenerateParams) => {
      const {
        tabId,
        messageId,
        newContent,
        model,
        providerId,
        generalPrompt,
        memoryPrompt,
        characterPrompt
      } = params
      const activeSessionId = useChatUiStore.getState().activeSessionIdByTab[tabId]
      if (!activeSessionId) throw new Error('No active session')

      const prev = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || []
      const session = prev.find((s) => s.id === activeSessionId)
      if (!session) throw new Error('Session not found')

      const msgIndex = session.messages.findIndex((m) => m.id === messageId)
      if (msgIndex === -1) throw new Error('Message not found')

      const truncatedMessages = session.messages.slice(0, msgIndex + 1)
      truncatedMessages[msgIndex] = {
        ...truncatedMessages[msgIndex],
        content: newContent,
        timestamp: Date.now()
      }

      const sessionsWithEdit = prev.map((s) =>
        s.id === activeSessionId ? { ...s, messages: truncatedMessages, updatedAt: Date.now() } : s
      )
      persistSessions(sessionsWithEdit)
      queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, sessionsWithEdit)
      queryClient.setQueryData(QUERY_KEYS.AI.MESSAGES(activeSessionId), truncatedMessages)

      useChatUiStore.getState().setStreaming(tabId, true)

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
          providerId || undefined
        )

        if (!reply) {
          throw new Error('Empty reply')
        }

        const sessionsWithReply = addMessageToSession(
          queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || sessionsWithEdit,
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
          queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || sessionsWithEdit,
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
        useChatUiStore.getState().setStreaming(tabId, false)
        useChatUiStore.getState().clearStreamingContent(tabId)
      }
    }
  })
}

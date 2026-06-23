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
import { generateId } from '../store/apiChatSessionUtils'
import { useChatUiStore } from '../store/chatUiStore'

function getUserMessage(text: string, imgs: string[], pid?: string): ApiChatMessage {
  return {
    id: generateId('msg') + '-user',
    role: 'user',
    content: text,
    timestamp: Date.now(),
    providerId: pid,
    images: imgs.length > 0 ? imgs : undefined
  }
}

function getMessagesFromSessions(sessions: ChatSession[], sessionId: string): ApiChatMessage[] {
  const session = sessions.find((s) => s.id === sessionId)
  return session?.messages || []
}

interface SendMessageParams {
  tabId: string
  text: string
  images: string[]
  model?: string
  providerId?: string
  generalPrompt?: string
  memoryPrompt?: string
  characterPrompt?: string
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: SendMessageParams) => {
      const {
        tabId,
        text,
        images,
        model,
        providerId,
        generalPrompt,
        memoryPrompt,
        characterPrompt
      } = params
      const activeSessionId = useChatUiStore.getState().activeSessionIdByTab[tabId]
      if (!activeSessionId) throw new Error('No active session')

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
        useChatUiStore.getState().setStreaming(tabId, false)
        useChatUiStore.getState().clearStreamingContent(tabId)
      }
    }
  })
}

interface RegenerateParams {
  tabId: string
  messages: ApiChatMessage[]
  model?: string
  providerId?: string
  generalPrompt?: string
  memoryPrompt?: string
  characterPrompt?: string
}

export function useRegenerateMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: RegenerateParams) => {
      const { tabId, messages, model, providerId, generalPrompt, memoryPrompt, characterPrompt } =
        params
      const activeSessionId = useChatUiStore.getState().activeSessionIdByTab[tabId]
      if (!activeSessionId) throw new Error('No active session')

      let truncatedMessages = [...messages]
      if (truncatedMessages[truncatedMessages.length - 1]?.role === 'assistant') {
        truncatedMessages.pop()
      }

      const prev = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || []
      const sessionsWithTrunc = prev.map((s) =>
        s.id === activeSessionId ? { ...s, messages: truncatedMessages, updatedAt: Date.now() } : s
      )
      persistSessions(sessionsWithTrunc)
      queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, sessionsWithTrunc)
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
      } finally {
        useChatUiStore.getState().setStreaming(tabId, false)
        useChatUiStore.getState().clearStreamingContent(tabId)
      }
    }
  })
}

interface EditAndRegenerateParams extends RegenerateParams {
  messageId: string
  newContent: string
}

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

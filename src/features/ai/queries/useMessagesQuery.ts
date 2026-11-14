import { QUERY_KEYS } from '@shared/query/queryKeys'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { loadSessions, persistSessions, removeMessageFromSession } from '../api/sessions.api'
import type { ChatSession } from '../store/apiChatSessionUtils'
import { getMessagesFromSessions } from './sendMessageUtils'

export function useMessagesQuery(sessionId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.AI.MESSAGES(sessionId || ''),
    queryFn: async () => {
      const sessions = await loadSessions()
      return getMessagesFromSessions(sessions, sessionId || '')
    },
    enabled: !!sessionId,
    staleTime: Infinity,
    gcTime: Infinity
  })
}

export function useDeleteMessageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, messageId }: { sessionId: string; messageId: string }) => {
      const prev =
        queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) ?? (await loadSessions())
      const updated = removeMessageFromSession(prev, sessionId, messageId)
      persistSessions(updated, {
        messageIdsBySession: { [sessionId]: [messageId] }
      })
      return { sessionId, allSessions: updated }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, data.allSessions)
      queryClient.setQueryData(
        QUERY_KEYS.AI.MESSAGES(data.sessionId),
        getMessagesFromSessions(data.allSessions, data.sessionId)
      )
    }
  })
}

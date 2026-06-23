import type { ApiChatMessage } from '@shared-core/types'

import { QUERY_KEYS } from '@shared/query/queryKeys'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { loadSessions, persistSessions, removeMessageFromSession } from '../api/sessions.api'
import type { ChatSession } from '../store/apiChatSessionUtils'

function getMessagesBySessionId(sessions: ChatSession[], sessionId: string): ApiChatMessage[] {
  const session = sessions.find((s) => s.id === sessionId)
  return session?.messages || []
}

export function useMessagesQuery(sessionId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.AI.MESSAGES(sessionId || ''),
    queryFn: () => {
      const sessions = loadSessions()
      return getMessagesBySessionId(sessions, sessionId || '')
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
      const prev = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || []
      const updated = removeMessageFromSession(prev, sessionId, messageId)
      persistSessions(updated)
      return { sessionId, allSessions: updated }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, data.allSessions)
      queryClient.setQueryData(
        QUERY_KEYS.AI.MESSAGES(data.sessionId),
        getMessagesBySessionId(data.allSessions, data.sessionId)
      )
    }
  })
}

import { QUERY_KEYS } from '@shared/query/queryKeys'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  clearSessionMessages,
  createNewSession,
  deleteSessionFromList,
  loadSessions,
  persistSessions,
  renameSession
} from '../api/sessions.api'
import type { ChatSession } from '../store/apiChatSessionUtils'

export function useSessionsQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.AI.SESSIONS,
    queryFn: loadSessions,
    staleTime: Infinity,
    gcTime: Infinity
  })
}

export function useCreateSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const newSession = createNewSession()
      const prev = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || []
      const updated = [newSession, ...prev]
      persistSessions(updated)
      return { session: newSession, allSessions: updated }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, data.allSessions)
    }
  })
}

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const prev = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || []
      const updated = deleteSessionFromList(prev, sessionId)
      persistSessions(updated)
      return { deletedId: sessionId, allSessions: updated }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, data.allSessions)
    }
  })
}

export function useRenameSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, title }: { sessionId: string; title: string }) => {
      const prev = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || []
      const updated = renameSession(prev, sessionId, title)
      persistSessions(updated)
      return updated
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, updated)
    }
  })
}

export function useClearSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const prev = queryClient.getQueryData<ChatSession[]>(QUERY_KEYS.AI.SESSIONS) || []
      const updated = clearSessionMessages(prev, sessionId)
      persistSessions(updated)
      return updated
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, updated)
    }
  })
}

export function useClearAllSessionsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const newSession = createNewSession()
      persistSessions([newSession])
      return [newSession]
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.AI.SESSIONS, updated)
    }
  })
}

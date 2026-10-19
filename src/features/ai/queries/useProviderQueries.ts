import { QUERY_KEYS } from '@shared/query/queryKeys'

import { useQuery } from '@tanstack/react-query'

import { getApiChatConfig } from '../api/sessions.api'

export function useApiConfigQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.AI.CONFIG(),
    queryFn: getApiChatConfig,
    staleTime: Infinity,
    gcTime: Infinity
  })
}

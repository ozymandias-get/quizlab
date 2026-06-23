import { QUERY_KEYS } from '@shared/query/queryKeys'

import { useQuery } from '@tanstack/react-query'

import { fetchApiChatModels, getApiChatConfig } from '../api/sessions.api'

// ---------------------------------------------------------------------------
// Provider health — checks if a given provider is reachable by probing its
// model list endpoint. Short staleTime so the UI stays responsive to network
// changes without excessive refetching.
// ---------------------------------------------------------------------------

export function useProviderHealthQuery(providerId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.AI.PROVIDER_HEALTH(providerId),
    queryFn: async () => {
      try {
        const models = await fetchApiChatModels(providerId)
        return { healthy: true, models: models ?? [], providerId }
      } catch {
        return { healthy: false, models: [] as string[], providerId }
      }
    },
    // Health is transient — recheck after 30 seconds
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 2,
    retry: 1,
    // Don't fetch until we have a providerId
    enabled: !!providerId
  })
}

// ---------------------------------------------------------------------------
// Provider model list — the available models for a given provider.
// Longer staleTime because model lists change infrequently.
// ---------------------------------------------------------------------------

export function useModelsQuery(providerId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.AI.MODELS(providerId),
    queryFn: () => fetchApiChatModels(providerId),
    staleTime: 1000 * 60 * 30, // 30 minutes — model lists are stable
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
    enabled: !!providerId
  })
}

// ---------------------------------------------------------------------------
// AI Config — the persisted ApiConfig (prompts, selected provider/model).
// This is the replacement for reading config from the old store.
// ---------------------------------------------------------------------------

export function useApiConfigQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.AI.CONFIG(),
    queryFn: getApiChatConfig,
    staleTime: Infinity,
    gcTime: Infinity
  })
}

import type { ApiConfig } from '@shared-core/types'

import { Logger } from '@shared/lib/logger'
import { QUERY_KEYS } from '@shared/query/queryKeys'

import { useQueryClient } from '@tanstack/react-query'

import { useElectronMutation, useElectronQuery } from '../useElectron'

/** Fills nullable fields so consumers always receive a complete draft shape. */
export function normalizeApiConfig(cfg: ApiConfig): ApiConfig {
  return {
    providers: cfg.providers || [],
    generalPrompt: cfg.generalPrompt || '',
    memoryPrompt: cfg.memoryPrompt || '',
    characterPrompt: cfg.characterPrompt || '',
    selectedProviderId: cfg.selectedProviderId || '',
    selectedModel: cfg.selectedModel || ''
  }
}

/**
 * Loads the persisted API chat configuration (STD-014). Consumed as the
 * source of truth for settings draft state instead of manual
 * `useEffect` + `.then()` fetches.
 */
export function useApiChatConfigQuery() {
  return useElectronQuery<ApiConfig | null>({
    key: QUERY_KEYS.AI.API_CHAT_CONFIG,
    queryFn: (api) => (api.getApiChatConfig ? api.getApiChatConfig() : Promise.resolve(null)),
    options: { staleTime: Infinity }
  })
}

/** Persists the API chat configuration; surfaces failures via error toast. */
export function useSaveApiChatConfigMutation() {
  const queryClient = useQueryClient()
  return useElectronMutation(
    async (api, config: ApiConfig) => {
      const saved = api.saveApiChatConfig ? await api.saveApiChatConfig(config) : false
      // The main process answers `false` for a rejected URL, so a resolved
      // mutation is not a completed save unless it is true.
      if (!saved) throw new Error('chat_config_save_failed')
      return saved
    },
    {
      errorMessage: 'toast_ai_config_save_failed',
      onSuccess: (_data, config) => {
        // The settings draft, the chat page and the provider list all read this
        // cache. Without updating it, `staleTime: Infinity` keeps serving the
        // pre-save object and the next remount overwrites the saved draft.
        queryClient.setQueryData(QUERY_KEYS.AI.API_CHAT_CONFIG, normalizeApiConfig(config))
      },
      onError: (error) => {
        Logger.error('[ApiChatApi] Failed to save config:', error)
      }
    }
  )
}

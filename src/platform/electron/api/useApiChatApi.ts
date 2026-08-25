import type { ApiConfig } from '@shared-core/types'

import { Logger } from '@shared/lib/logger'

import { useElectronMutation, useElectronQuery } from '../useElectron'

const API_CHAT_CONFIG_KEY = ['api-chat', 'config'] as const

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
    key: API_CHAT_CONFIG_KEY,
    queryFn: (api) => (api.getApiChatConfig ? api.getApiChatConfig() : Promise.resolve(null)),
    options: { staleTime: Infinity }
  })
}

/** Persists the API chat configuration; surfaces failures via error toast. */
export function useSaveApiChatConfigMutation() {
  return useElectronMutation(
    (api, config: ApiConfig) =>
      api.saveApiChatConfig ? api.saveApiChatConfig(config) : Promise.resolve(undefined),
    {
      errorMessage: 'toast_ai_config_save_failed',
      onError: (error) => {
        Logger.error('[ApiChatApi] Failed to save config:', error)
      }
    }
  )
}

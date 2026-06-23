import type { AiRegistryResponse, AiSelectorConfig } from '@shared-core/types'

import { useToastActions } from '@shared/stores/toastStore'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useElectronMutation, useElectronQuery } from '../useElectron'

const AI_REGISTRY_KEY = ['ai', 'registry']
export const AI_CONFIG_KEY = (hostname?: string) =>
  hostname ? ['ai', 'config', hostname] : ['ai', 'config']

/**
 * AI Registry Query
 */
export function useAiRegistry() {
  return useElectronQuery<AiRegistryResponse | null>({
    key: AI_REGISTRY_KEY,
    queryFn: (api) => api.getAiRegistry(false),
    options: {
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60 * 24
    }
  })
}

/**
 * Save AI Config Mutation
 *
 * Pass `{ suppressErrorToast: true }` when the caller wants to handle the
 * failure path itself with a domain-specific message (e.g. the picker flow
 * shows `picker_save_failed` with the underlying error).
 */
export function useSaveAiConfig(options?: { suppressErrorToast?: boolean }) {
  const queryClient = useQueryClient()
  const { showSuccess } = useToastActions()
  const { t } = useTranslation()

  return useElectronMutation<boolean, { hostname: string; config: AiSelectorConfig }>(
    (api, { hostname, config }) => api.saveAiConfig(hostname, config),
    {
      errorMessage: t('toast_ai_config_save_failed'),
      showErrorToast: !options?.suppressErrorToast,
      onSuccess: (_, { hostname }) => {
        queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY(hostname) })
        queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY() })
        showSuccess(t('toast_ai_config_saved'), t('toast_config_saved'))
      }
    }
  )
}

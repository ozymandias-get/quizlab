import type {
  AiSelectorConfig,
  ClearAiModelDataInput,
  CustomAiInput,
  CustomAiResult
} from '@shared-core/types'

import { useToastActions } from '@shared/stores/toastStore'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useElectronMutation, useElectronQuery } from '../useElectron'
import { AI_CONFIG_KEY } from './useAiApi'

const AI_REGISTRY_KEY = ['ai', 'registry']

/**
 * AI Config Query
 */
export function useAiConfig(hostname?: string) {
  return useElectronQuery<AiSelectorConfig | Record<string, AiSelectorConfig> | null>({
    key: AI_CONFIG_KEY(hostname),
    queryFn: (api) => api.getAiConfig(hostname),
    options: {
      enabled: !!hostname || hostname === undefined,
      staleTime: 1000 * 60 * 5
    }
  })
}

/**
 * Delete AI Config Mutation
 */
export function useDeleteAiConfig() {
  const queryClient = useQueryClient()
  const { showSuccess } = useToastActions()
  const { t } = useTranslation()

  return useElectronMutation<boolean, string>((api, hostname) => api.deleteAiConfig(hostname), {
    errorMessage: t('toast_ai_config_delete_failed'),
    onSuccess: (_, hostname) => {
      queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY(hostname) })
      queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY() })
      showSuccess(t('toast_ai_config_deleted'), t('toast_config_deleted'))
    }
  })
}

/**
 * Add Custom AI Mutation
 */
export function useAddCustomAi() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastActions()
  const { t } = useTranslation()

  return useElectronMutation<CustomAiResult, CustomAiInput>(
    (api, input) => api.addCustomAi(input),
    {
      errorMessage: t('toast_custom_ai_failed'),
      onSuccess: (data) => {
        if (data.ok) {
          queryClient.invalidateQueries({ queryKey: AI_REGISTRY_KEY })
          showSuccess(
            t('toast_custom_ai_added', { name: data.data.platform?.name || 'AI' }),
            t('toast_ai_added_title')
          )
        } else {
          showError(data.error.message || t('toast_custom_ai_failed'), t('toast_ai_error_title'))
        }
      }
    }
  )
}

/**
 * Delete Custom AI Mutation
 */
export function useDeleteCustomAi() {
  const queryClient = useQueryClient()
  const { showSuccess } = useToastActions()
  const { t } = useTranslation()

  return useElectronMutation<boolean, string>((api, id) => api.deleteCustomAi(id), {
    errorMessage: t('toast_custom_ai_delete_failed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_REGISTRY_KEY })
      showSuccess(t('toast_custom_ai_deleted'), t('toast_ai_deleted_title'))
    }
  })
}

/**
 * Clear AI Model Data Mutation
 */
export function useClearAiModelData() {
  const queryClient = useQueryClient()
  const { showSuccess } = useToastActions()
  const { t } = useTranslation()

  return useElectronMutation<boolean, ClearAiModelDataInput>(
    async (api, input) => {
      const result = await api.clearAiModelData(input)
      if (!result) {
        throw new Error(t('toast_ai_model_data_clear_failed'))
      }
      return result
    },
    {
      errorMessage: t('toast_ai_model_data_clear_failed'),
      onSuccess: () => {
        queryClient.invalidateQueries()
        showSuccess(t('toast_ai_model_data_cleared'), t('toast_system_title'))
      }
    }
  )
}

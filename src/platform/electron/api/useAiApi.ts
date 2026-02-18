import { useQueryClient } from '@tanstack/react-query'
import { useElectronQuery, useElectronMutation } from '../useElectron'
import type {
    AiRegistryResponse,
    AiSelectorConfig,
    CustomAiInput,
    CustomAiResult
} from '@shared/types'
import { useToast } from '@src/app/providers/ToastContext'
import { useLanguage } from '@src/app/providers/LanguageContext'

export const AI_REGISTRY_KEY = ['ai', 'registry']
export const AI_CONFIG_KEY = (hostname?: string) => hostname ? ['ai', 'config', hostname] : ['ai', 'config']

/**
 * AI Registry Query
 */
export function useAiRegistry() {
    return useElectronQuery<AiRegistryResponse>({
        key: AI_REGISTRY_KEY,
        queryFn: (api) => api.getAiRegistry(false),
        options: {
            staleTime: Infinity, // Use React Query cache instead of preload
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
        }
    })
}

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
 * Refresh AI Registry Mutation (Force Backend Refresh)
 */
export function useRefreshAiRegistry() {
    const queryClient = useQueryClient()

    return useElectronMutation<AiRegistryResponse, void>(
        (api) => api.getAiRegistry(true),
        {
            onSuccess: (data) => {
                queryClient.setQueryData(AI_REGISTRY_KEY, data)
            }
        }
    )
}

/**
 * Save AI Config Mutation
 */
export function useSaveAiConfig() {
    const queryClient = useQueryClient()
    const { showSuccess } = useToast()
    const { t } = useLanguage()

    return useElectronMutation<boolean, { hostname: string; config: AiSelectorConfig }>(
        (api, { hostname, config }) => api.saveAiConfig(hostname, config),
        {
            errorMessage: t('toast_ai_config_save_failed'),
            onSuccess: (_, { hostname }) => {
                queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY(hostname) })
                queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY() })
                showSuccess(t('toast_ai_config_saved'), t('toast_config_saved'))
            }
        }
    )
}

/**
 * Delete AI Config Mutation
 */
export function useDeleteAiConfig() {
    const queryClient = useQueryClient()
    const { showSuccess } = useToast()
    const { t } = useLanguage()

    return useElectronMutation<boolean, string>(
        (api, hostname) => api.deleteAiConfig(hostname),
        {
            errorMessage: t('toast_ai_config_delete_failed'),
            onSuccess: (_, hostname) => {
                queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY(hostname) })
                queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY() })
                showSuccess(t('toast_ai_config_deleted'), t('toast_config_deleted'))
            }
        }
    )
}

/**
 * Add Custom AI Mutation
 */
export function useAddCustomAi() {
    const queryClient = useQueryClient()
    const { showSuccess, showError } = useToast()
    const { t } = useLanguage()

    return useElectronMutation<CustomAiResult, CustomAiInput>(
        (api, data) => api.addCustomAi(data),
        {
            errorMessage: t('toast_custom_ai_failed'),
            onSuccess: (result) => {
                if (result.success) {
                    queryClient.invalidateQueries({ queryKey: AI_REGISTRY_KEY })
                    showSuccess(t('toast_custom_ai_added', { name: result.platform?.name || 'AI' }), t('toast_ai_added_title'))
                } else {
                    // Use showError directly — throwing inside onSuccess bypasses onError handler
                    showError(result.error || t('toast_custom_ai_failed'), t('toast_ai_error_title'))
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
    const { showSuccess } = useToast()
    const { t } = useLanguage()

    return useElectronMutation<boolean, string>(
        (api, id) => api.deleteCustomAi(id),
        {
            errorMessage: t('toast_custom_ai_delete_failed'),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: AI_REGISTRY_KEY })
                showSuccess(t('toast_custom_ai_deleted'), t('toast_ai_deleted_title'))
            }
        }
    )
}


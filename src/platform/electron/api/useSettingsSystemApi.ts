import { useToastActions } from '@shared/stores/toastStore'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useElectronMutation, useElectronQuery } from '../useElectron'

const SYSTEM_VERSION_KEY = ['system', 'version']

/**
 * App Version Query
 */
export function useAppVersion() {
  return useElectronQuery<string>({
    key: SYSTEM_VERSION_KEY,
    queryFn: (api) => api.getAppVersion(),
    options: {
      staleTime: Infinity
    }
  })
}

/**
 * Clear Cache Mutation
 */
export function useClearCache() {
  const queryClient = useQueryClient()
  const { showSuccess } = useToastActions()
  const { t } = useTranslation()

  return useElectronMutation<boolean, void>((api) => api.clearCache(), {
    errorMessage: t('toast_cache_cleared_failed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'cache-info'] })
      showSuccess(t('toast_cache_cleared'), t('toast_system_title'))
    }
  })
}

/**
 * Deep Clean Cache Mutation
 */
export function useDeepCleanCache() {
  const queryClient = useQueryClient()
  const { showSuccess } = useToastActions()
  const { t } = useTranslation()

  return useElectronMutation<boolean, void>((api) => api.deepCleanCache(), {
    errorMessage: t('toast_cache_cleared_failed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'cache-info'] })
      showSuccess(t('toast_cache_cleared'), t('toast_system_title'))
    }
  })
}

/**
 * Cache Info Query
 */
export function useCacheInfo() {
  return useElectronQuery({
    key: ['system', 'cache-info'],
    queryFn: (api) => api.getCacheInfo(),
    options: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false
    }
  })
}

/**
 * Open External Link Mutation
 */
export function useOpenExternal() {
  const { t } = useTranslation()
  return useElectronMutation<boolean, string>((api, url) => api.openExternal(url), {
    errorMessage: t('toast_open_link_failed')
  })
}

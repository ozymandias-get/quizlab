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
 * Cache Info Query (smart enriched)
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

export function useSetCacheAutoClean() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  return useElectronMutation<boolean, boolean>((api, enabled) => api.setCacheAutoClean(enabled), {
    errorMessage: t('toast_cache_cleared_failed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'cache-info'] })
    }
  })
}

export function useSmartCacheAction() {
  const queryClient = useQueryClient()
  const { showSuccess } = useToastActions()
  const { t } = useTranslation()
  return useElectronMutation<boolean, 'clean_cold' | 'clean_all'>(
    (api, action) => api.smartCacheAction(action),
    {
      errorMessage: t('toast_cache_cleared_failed'),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['system', 'cache-info'] })
        showSuccess(t('toast_cache_cleared'), t('toast_system_title'))
      }
    }
  )
}

export function useClearPartitionCache() {
  const queryClient = useQueryClient()
  const { showSuccess } = useToastActions()
  const { t } = useTranslation()
  return useElectronMutation<boolean, { partition: string }>(
    (api, input) => {
      const partition = input.partition.startsWith('persist:')
        ? input.partition
        : `persist:${input.partition}`
      const rawKey = partition.replace(/^persist:/, '')
      const id = rawKey.startsWith('ai_') ? rawKey.replace(/^ai_/, '') : rawKey
      // id may be empty or not match, but clearAiModelData will fallback to partition check
      return api.clearAiModelData({ id, partition } as unknown as Parameters<
        typeof api.clearAiModelData
      >[0])
    },
    {
      errorMessage: t('toast_cache_cleared_failed'),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['system', 'cache-info'] })
        showSuccess(t('toast_cache_cleared'), t('toast_system_title'))
      }
    }
  )
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

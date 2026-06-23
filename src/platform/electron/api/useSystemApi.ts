import type { UpdateCheckResult } from '@shared-core/types'

import { useToastActions } from '@shared/stores/toastStore'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useElectronMutation, useElectronQuery } from '../useElectron'

const SYSTEM_VERSION_KEY = ['system', 'version']
const SYSTEM_UPDATE_KEY = ['system', 'update']

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
 * Check For Updates Query
 */
export function useCheckForUpdates(enabled: boolean = false) {
  return useElectronQuery<UpdateCheckResult>({
    key: SYSTEM_UPDATE_KEY,
    queryFn: (api) => api.checkForUpdates(),
    options: {
      enabled,
      staleTime: 1000 * 60 * 30
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
      queryClient.invalidateQueries()
      showSuccess(t('toast_cache_cleared'), t('toast_system_title'))
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

/**
 * Copy Image To Clipboard Mutation
 */
export function useCopyImageToClipboard() {
  const { t } = useTranslation()
  return useElectronMutation<boolean, string>((api, dataUrl) => api.copyImageToClipboard(dataUrl), {
    errorMessage: t('toast_copy_failed'),
    // Pipeline (imageSendPipeline) kendi hata yönetimini yapıp
    // error_clipboard_failed toast'ını gösteriyor.
    // showErrorToast:false ile mutation'ın ayrı bir toast
    // göstermesi engellenerek çift toast önleniyor.
    showErrorToast: false
  })
}

/**
 * Capture Screen Mutation
 */
export function useCaptureScreen() {
  const { showSuccess } = useToastActions()
  const { t } = useTranslation()

  return useElectronMutation<
    string | null,
    { x: number; y: number; width: number; height: number } | undefined
  >((api, rect) => api.captureScreen(rect), {
    errorMessage: t('toast_capture_failed'),
    onSuccess: (result) => {
      if (result) {
        showSuccess(t('toast_screenshot_captured'), t('toast_system_title'))
      }
    }
  })
}

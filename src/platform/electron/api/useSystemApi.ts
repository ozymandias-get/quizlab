import { useQueryClient } from '@tanstack/react-query'
import { useElectronQuery, useElectronMutation } from '../useElectron'
import type { UpdateCheckResult } from '@shared/types'
import { useToast } from '@src/app/providers/ToastContext'
import { useLanguage } from '@src/app/providers/LanguageContext'

export const SYSTEM_VERSION_KEY = ['system', 'version']
export const SYSTEM_UPDATE_KEY = ['system', 'update']

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
            staleTime: 1000 * 60 * 30 // 30 min
        }
    })
}

/**
 * Clear Cache Mutation
 */
export function useClearCache() {
    const queryClient = useQueryClient()
    const { showSuccess } = useToast()
    const { t } = useLanguage()

    return useElectronMutation<boolean, void>(
        (api) => api.clearCache(),
        {
            errorMessage: t('toast_cache_cleared_failed'),
            onSuccess: () => {
                queryClient.invalidateQueries()
                showSuccess(t('toast_cache_cleared'), t('toast_system_title'))
            }
        }
    )
}

/**
 * Open External Link Mutation
 */
export function useOpenExternal() {
    const { t } = useLanguage()
    return useElectronMutation<boolean, string>(
        (api, url) => api.openExternal(url),
        {
            errorMessage: t('toast_open_link_failed')
        }
    )
}

/**
 * Copy Image To Clipboard Mutation
 */
export function useCopyImageToClipboard() {
    const { t } = useLanguage()
    return useElectronMutation<boolean, string>(
        (api, dataUrl) => api.copyImageToClipboard(dataUrl),
        {
            errorMessage: t('toast_copy_failed')
        }
    )
}

/**
 * Capture Screen Mutation
 */
export function useCaptureScreen() {
    const { showSuccess } = useToast()
    const { t } = useLanguage()

    return useElectronMutation<string | null, { x: number; y: number; width: number; height: number } | undefined>(
        (api, rect) => api.captureScreen(rect),
        {
            errorMessage: t('toast_capture_failed'),
            onSuccess: (result) => {
                if (result) {
                    showSuccess(t('toast_screenshot_captured'), t('toast_system_title'))
                }
            }
        }
    )
}


import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'
import type { GeminiWebSessionActionResult, GeminiWebSessionStatus } from '@shared-core/types'

import type { UseQueryOptions } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useElectronMutation, useElectronQuery } from '../useElectron'

export const GEMINI_WEB_STATUS_KEY = ['gemini-web', 'status'] as const

/**
 * Error key returned by Gemini Web Session refresh actions when the user
 * must log in manually (e.g. login redirect, challenge required). Shared
 * across refresh listeners and the settings tab state hook so the two
 * event sources agree on what "requires manual login" means.
 */
export const GEMINI_WEB_REQUIRES_LOGIN_ERROR = 'error_refresh_failed_requires_login'

export function useGeminiWebStatus(
  options?: Omit<
    UseQueryOptions<GeminiWebSessionStatus | null, Error, GeminiWebSessionStatus | null>,
    'queryKey' | 'queryFn'
  >
) {
  return useElectronQuery<GeminiWebSessionStatus | null>({
    key: GEMINI_WEB_STATUS_KEY,
    queryFn: (api) => api.geminiWeb.getStatus(),
    options: {
      staleTime: 0,
      retry: false,
      ...options
    }
  })
}

function useGeminiWebMutation<Payload>(
  action: (api: Window['electronAPI'], payload: Payload) => Promise<GeminiWebSessionActionResult>,
  errorKey: string,
  options?: { invalidateAiRegistry?: boolean }
) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useElectronMutation<GeminiWebSessionActionResult, Payload>(action, {
    errorMessage: t(errorKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GEMINI_WEB_STATUS_KEY })
      if (options?.invalidateAiRegistry) {
        queryClient.invalidateQueries({ queryKey: ['ai', 'registry'] })
      }
    }
  })
}

export function useGeminiWebResetProfile() {
  return useGeminiWebMutation<void>((api) => api.geminiWeb.resetProfile(), 'toast_gws_reset_failed')
}

export function useGeminiWebSetEnabled() {
  return useGeminiWebMutation<boolean>(
    (api, enabled) => api.geminiWeb.setEnabled(enabled),
    'toast_gws_toggle_failed',
    { invalidateAiRegistry: true }
  )
}

export function useGeminiWebSetEnabledApps() {
  return useGeminiWebMutation<GoogleWebSessionAppId[]>(
    (api, enabledAppIds) => api.geminiWeb.setEnabledApps(enabledAppIds),
    'toast_gws_toggle_failed',
    { invalidateAiRegistry: true }
  )
}

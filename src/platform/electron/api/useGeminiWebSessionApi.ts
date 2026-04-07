import { useQueryClient } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { useElectronMutation, useElectronQuery } from '../useElectron'
import type { GeminiWebSessionActionResult, GeminiWebSessionStatus } from '@shared-core/types'
import { useLanguageStrings } from '@app/providers/LanguageContext'
import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'

const GEMINI_WEB_STATUS_KEY = ['gemini-web', 'status']

export function useGeminiWebStatus(
  options?: Omit<
    UseQueryOptions<GeminiWebSessionStatus, Error, GeminiWebSessionStatus>,
    'queryKey' | 'queryFn'
  >
) {
  return useElectronQuery<GeminiWebSessionStatus>({
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
  const { t } = useLanguageStrings()
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

export function useGeminiWebOpenLogin() {
  return useGeminiWebMutation<void>((api) => api.geminiWeb.openLogin(), 'toast_gws_login_failed')
}

export function useGeminiWebCheckNow() {
  return useGeminiWebMutation<void>((api) => api.geminiWeb.checkNow(), 'toast_gws_check_failed')
}

export function useGeminiWebReauth() {
  return useGeminiWebMutation<void>((api) => api.geminiWeb.reauth(), 'toast_gws_reauth_failed')
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

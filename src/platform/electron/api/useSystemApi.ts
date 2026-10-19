import type { UpdateCheckResult } from '@shared-core/types'

import { useToastActions } from '@shared/stores/toastStore'

import { useTranslation } from 'react-i18next'

import { useElectronMutation, useElectronQuery } from '../useElectron'

const SYSTEM_UPDATE_KEY = ['system', 'update']

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

export function useOpenExternal() {
  const { t } = useTranslation()
  return useElectronMutation<boolean, string>((api, url) => api.openExternal(url), {
    errorMessage: t('toast_open_link_failed')
  })
}

/**
 * `scope` panodaki snapshot'ın sahibini işaretler: çoklu görsel gönderiminin
 * tüm kopyaları aynı kapsamı taşır ve tek bir `restoreClipboard(scope)` çağrısı
 * kullanıcının panosunu geri getirir. Eşzamanlı gönderimler birbirinin
 * snapshot'ını tüketmez.
 */
export function useCopyImageToClipboard() {
  const { t } = useTranslation()
  return useElectronMutation<boolean, { dataUrl: string; scope?: string }>(
    (api, input) => api.copyImageToClipboard(input.dataUrl, input.scope),
    {
      errorMessage: t('toast_copy_failed'),
      // Pipeline (imageSendPipeline) kendi hata yönetimini yapıp
      // error_clipboard_failed toast'ını gösteriyor.
      // showErrorToast:false ile mutation'ın ayrı bir toast
      // göstermesi engellenerek çift toast önleniyor.
      showErrorToast: false
    }
  )
}

export function useCaptureScreen() {
  const { showSuccess } = useToastActions()
  const { t } = useTranslation()

  return useElectronMutation<
    string | null,
    { x: number; y: number; width: number; height: number } | undefined
  >((api, rect) => api.captureScreen(rect), {
    errorMessage: t('toast_capture_failed'),
    onSuccess: (data) => {
      if (data) {
        showSuccess(t('toast_screenshot_captured'), t('toast_system_title'))
      }
    }
  })
}

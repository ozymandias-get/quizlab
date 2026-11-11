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

/**
 * Turn captured PNG bytes into the data URL the UI consumes.
 *
 * `FileReader` performs the base64 conversion without a synchronous
 * main-thread encode, which is the point of transporting bytes rather than a
 * data URL over IPC. A failed read resolves to `null`, matching "nothing was
 * captured" instead of handing the caller a broken image.
 */
function pngBytesToDataUrl(bytes: Uint8Array): Promise<string | null> {
  // An empty capture is not an image; FileReader would otherwise turn it into
  // the truthy string "data:image/png;base64," and report a false success.
  if (!bytes || bytes.byteLength === 0) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      // Copy into a fresh ArrayBuffer-backed view: `BlobPart` does not accept a
      // view that might be backed by a SharedArrayBuffer.
      reader.readAsDataURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
    } catch {
      resolve(null)
    }
  })
}

export function useCaptureScreen() {
  const { showSuccess } = useToastActions()
  const { t } = useTranslation()

  return useElectronMutation<
    string | null,
    { x: number; y: number; width: number; height: number } | undefined
  >(
    async (api, rect) => {
      const png = await api.captureScreen(rect)
      if (!png) return null
      return pngBytesToDataUrl(png)
    },
    {
      errorMessage: t('toast_capture_failed'),
      onSuccess: (data) => {
        if (data) {
          showSuccess(t('toast_screenshot_captured'), t('toast_system_title'))
        }
      }
    }
  )
}

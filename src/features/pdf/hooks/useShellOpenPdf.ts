import { useToastActions } from '@app/providers'
import { getElectronApi } from '@shared/lib/electronApi'
import { Logger } from '@shared/lib/logger'

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { usePdfTabStore } from '../store/usePdfTabStore'
import { useReadingProgressPersistence } from './useReadingProgressPersistence'

/**
 * Windows Explorer sağ-tık "QuizLab ile Aç" akışını karşılar.
 *
 * Main process, Explorer'dan gelen her PDF yolu için `onShellOpenPdf`
 * olayını tetikler. Her dosya mevcut sekmeler korunarak YENİ sekmede
 * açılır (2 panelli yapı / AI ekranı etkilenmez).
 */
export function useShellOpenPdf(): void {
  const { t } = useTranslation()
  const { showError, showSuccess } = useToastActions()
  const { upsertLastReadingInfo } = useReadingProgressPersistence()
  const openingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const api = getElectronApi()
    if (!api?.onShellOpenPdf) return

    const unsubscribe = api.onShellOpenPdf((filePath: string) => {
      if (!filePath || openingRef.current.has(filePath)) return
      openingRef.current.add(filePath)

      void (async () => {
        try {
          const electronApi = getElectronApi()
          if (!electronApi) return
          const result = await electronApi.registerPdfPath(filePath)
          if (!result) {
            showError('error_pdf_moved', undefined, {
              fileName: filePath.split(/[\\/]/).pop() || filePath
            })
            return
          }
          usePdfTabStore.getState().openPdfInTab(result)
          if (result.path && result.name) {
            upsertLastReadingInfo({
              name: result.name,
              path: result.path,
              page: 1,
              totalPages: 0,
              lastOpenedAt: Date.now()
            })
          }
          showSuccess('toast_opened', undefined, { fileName: result.name })
        } catch (error) {
          Logger.error('[useShellOpenPdf] Shell open error:', error)
          showError(t('error_pdf_load'))
        } finally {
          openingRef.current.delete(filePath)
        }
      })()
    })

    return unsubscribe
  }, [showError, showSuccess, t, upsertLastReadingInfo])
}

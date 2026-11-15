import { getElectronApi } from '@shared/lib/electronApi'
import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { isSamePdfPath, normalizePdfPathKey } from '../lib/pdfPathIdentity'
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
  const { recordPdfOpened } = useReadingProgressPersistence()
  const openingRef = useRef<Set<string>>(new Set())
  // A second Explorer request for the same path arrives while the first is
  // still registering. It is not opened twice, but it must bring the finished
  // tab forward instead of being dropped.
  const pendingFocusRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const api = getElectronApi()
    if (!api?.onShellOpenPdf) return

    const unsubscribe = api.onShellOpenPdf((filePath: string) => {
      if (!filePath) return
      const pathKey = normalizePdfPathKey(filePath)
      if (openingRef.current.has(pathKey)) {
        pendingFocusRef.current.add(pathKey)
        return
      }
      openingRef.current.add(pathKey)

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
            // Keep the stored page: opening from Explorer is not a navigation
            // back to page one.
            recordPdfOpened({
              name: result.name,
              path: result.path,
              lastOpenedAt: Date.now()
            })
          }
          showSuccess('toast_opened', undefined, { fileName: result.name })
        } catch (error) {
          Logger.error('[useShellOpenPdf] Shell open error:', error)
          showError(t('error_pdf_load'))
        } finally {
          openingRef.current.delete(pathKey)
          if (pendingFocusRef.current.delete(pathKey)) {
            const tab = usePdfTabStore
              .getState()
              .pdfTabs.find((candidate) => isSamePdfPath(candidate.file?.path, filePath))
            if (tab) usePdfTabStore.getState().setActivePdfTab(tab.id)
          }
        }
      })()
    })

    // Main queues Explorer paths until this listener exists; a fixed delay is
    // only the fallback for a renderer that never sends this signal.
    api.notifyShellPdfReady?.()
    return unsubscribe
  }, [showError, showSuccess, t, recordPdfOpened])
}

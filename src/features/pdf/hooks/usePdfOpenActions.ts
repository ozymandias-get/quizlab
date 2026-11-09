import type { PdfFile } from '@shared-core/types'

import {
  getDroppedFilePath,
  useRegisterPdfPath,
  useSelectPdf
} from '@platform/electron/api/usePdfApi'

import { useToastActions } from '@app/providers'
import { Logger } from '@shared/lib/logger'

import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { LastReadingInfo, PdfTab, ResumePdfResult } from './types'

interface UsePdfOpenActionsProps {
  openPdfInTab: (file: PdfFile) => PdfTab
  upsertLastReadingInfo: (info: LastReadingInfo) => void
  flushPendingReadingProgress: () => void
  recentReadingInfoRef: { current: LastReadingInfo[] }
}

export function usePdfOpenActions({
  openPdfInTab,
  upsertLastReadingInfo,
  flushPendingReadingProgress,
  recentReadingInfoRef
}: UsePdfOpenActionsProps) {
  const { showError, showSuccess } = useToastActions()
  const { t } = useTranslation()

  const { mutateAsync: selectPdf } = useSelectPdf()
  const { mutateAsync: registerPdfPath } = useRegisterPdfPath()

  const lastLoadRequestId = useRef<number>(0)

  const handleOpenPdfWithInfo = useCallback(
    (file: PdfFile, initialReadInfo?: Partial<LastReadingInfo>) => {
      openPdfInTab(file)
      if (file.path && file.name) {
        upsertLastReadingInfo({
          name: file.name,
          path: file.path,
          page: 1,
          totalPages: 0,
          lastOpenedAt: Date.now(),
          ...initialReadInfo
        })
      }
    },
    [openPdfInTab, upsertLastReadingInfo]
  )

  const handleSelectPdf = useCallback(async () => {
    const currentRequestId = ++lastLoadRequestId.current

    try {
      const result = await selectPdf({ filterName: t('pdf_documents') })

      if (currentRequestId !== lastLoadRequestId.current || !result) return

      handleOpenPdfWithInfo(result)
    } catch (error) {
      if (currentRequestId === lastLoadRequestId.current) {
        Logger.error('[usePdfOpenActions] PDF Selection Error:', error)
        // A cancelled picker returns null, not a rejection; reaching here means
        // the file could not be read or the IPC call failed.
        showError('error_pdf_load')
      }
    }
  }, [selectPdf, t, handleOpenPdfWithInfo, showError])

  const handlePdfDrop = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        showError('error_invalid_pdf')
        return
      }

      const filePath = getDroppedFilePath(file)
      if (!filePath) {
        // The drop passed the extension check but Electron could not resolve
        // a path. Silently doing nothing looks like a broken drop handler.
        Logger.warn('[usePdfOpenActions] A dropped PDF has no resolvable path')
        showError('error_pdf_load')
        return
      }

      const currentRequestId = ++lastLoadRequestId.current
      try {
        const result = await registerPdfPath(filePath)
        // The user may have navigated elsewhere while the file registered —
        // do not steal tab focus with a stale open.
        if (currentRequestId !== lastLoadRequestId.current || !result) return
        handleOpenPdfWithInfo(result)
        showSuccess('toast_opened', undefined, { fileName: result.name })
      } catch (error) {
        if (currentRequestId === lastLoadRequestId.current) {
          Logger.error('[usePdfOpenActions] Drop Error:', error)
          showError('error_pdf_load')
        }
      }
    },
    [registerPdfPath, showSuccess, showError, handleOpenPdfWithInfo]
  )

  const resumeLastPdf = useCallback(
    async (path?: string): Promise<ResumePdfResult> => {
      flushPendingReadingProgress()
      const history = recentReadingInfoRef.current
      const target = path ? history.find((entry) => entry.path === path) : history[0]

      if (!target) {
        return 'missing'
      }

      const currentRequestId = ++lastLoadRequestId.current
      try {
        const result = await registerPdfPath(target.path)
        if (currentRequestId !== lastLoadRequestId.current) {
          // The user switched tabs while the file was being registered; do
          // not yank focus back to the resumed document.
          return 'error'
        }
        if (result) {
          handleOpenPdfWithInfo(result, {
            ...target,
            name: result.name || target.name,
            path: result.path || target.path,
            page: target.page || 1,
            lastOpenedAt: Date.now()
          })
          return 'success'
        } else {
          showError('error_pdf_moved', undefined, { fileName: target.name })
          return 'not_found'
        }
      } catch (error) {
        Logger.error('[usePdfOpenActions] Resume Error:', error)
        const code = (error as { code?: string }).code
        if (code === 'not_found') {
          showError('error_pdf_moved', undefined, { fileName: target.name })
          return 'not_found'
        }
        if (code === 'invalid_input') {
          showError('error_invalid_pdf', undefined, { fileName: target.name })
          return 'error'
        }
        // Unauthorized, unreadable and transport failures are not proof that
        // the file moved: tell the user the load failed instead.
        showError('error_pdf_load', undefined, { fileName: target.name })
        return 'error'
      }
    },
    [
      registerPdfPath,
      showError,
      handleOpenPdfWithInfo,
      flushPendingReadingProgress,
      recentReadingInfoRef
    ]
  )

  return {
    handleSelectPdf,
    handlePdfDrop,
    resumeLastPdf
  }
}

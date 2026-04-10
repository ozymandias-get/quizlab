import { useCallback, useRef } from 'react'
import { Logger } from '@shared/lib/logger'
import { useToastActions, useLanguageStrings } from '@app/providers'
import { useSelectPdf, useRegisterPdfPath } from '@platform/electron/api/usePdfApi'
import type { PdfFile } from '@shared-core/types'
import type { LastReadingInfo, ResumePdfResult, PdfTab } from './types'

type DroppedPdfFile = File & { path?: string }

interface UsePdfOpenActionsProps {
  openPdfInTab: (file: PdfFile) => PdfTab
  upsertLastReadingInfo: (info: LastReadingInfo) => void
  flushPendingReadingProgress: () => void
  recentReadingInfoRef: { current: LastReadingInfo[] }
}

export const usePdfOpenActions = ({
  openPdfInTab,
  upsertLastReadingInfo,
  flushPendingReadingProgress,
  recentReadingInfoRef
}: UsePdfOpenActionsProps) => {
  const { showError, showSuccess } = useToastActions()
  const { t } = useLanguageStrings()

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

      if (currentRequestId === lastLoadRequestId.current && result) {
        handleOpenPdfWithInfo(result)
      }
    } catch (error) {
      if (currentRequestId === lastLoadRequestId.current) {
        Logger.error('[usePdfOpenActions] PDF Selection Error:', error)
      }
    }
  }, [selectPdf, t, handleOpenPdfWithInfo])

  const handlePdfDrop = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        showError('error_invalid_pdf')
        return
      }

      const filePath = (file as DroppedPdfFile).path
      if (!filePath) return

      try {
        const result = await registerPdfPath(filePath)
        if (result) {
          handleOpenPdfWithInfo(result)
          showSuccess('toast_opened', undefined, { fileName: result.name })
        }
      } catch (error) {
        Logger.error('[usePdfOpenActions] Drop Error:', error)
        showError('error_pdf_load')
      }
    },
    [registerPdfPath, showSuccess, showError, handleOpenPdfWithInfo]
  )

  const resumeLastPdf = useCallback(
    async (path?: string): Promise<ResumePdfResult> => {
      flushPendingReadingProgress()
      const history = recentReadingInfoRef.current
      const target = path ? history.find((item) => item.path === path) : history[0]

      if (!target) {
        return 'missing'
      }

      try {
        const result = await registerPdfPath(target.path)
        if (result) {
          handleOpenPdfWithInfo(result, {
            ...target,
            name: result.name || target.name,
            path: result.path || target.path,
            page: target.page || 1,
            lastOpenedAt: Date.now()
          })
          return 'success'
        }
      } catch (error) {
        Logger.error('[usePdfOpenActions] Resume Error:', error)
        if (path) {
          showError('recent_pdf_not_found', undefined, { fileName: target.name })
          return 'not_found'
        }
        showError('error_pdf_load')
        return 'error'
      }

      showError('error_pdf_load')
      return 'error'
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

import type { PdfFile } from '@shared-core/types'

import { useRegisterPdfPath, useSelectPdf } from '@platform/electron/api/usePdfApi'

import { useToastActions } from '@app/providers'
import { Logger } from '@shared/lib/logger'

import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { LastReadingInfo, PdfTab, ResumePdfResult } from './types'

type DroppedPdfFile = File & { path?: string }

// Multi-format: Docling supports DOCX, PPTX, HTML, MD and scanned images
const SUPPORTED_EXTENSIONS = [
  'pdf',
  'docx',
  'pptx',
  'html',
  'htm',
  'md',
  'markdown',
  'png',
  'jpg',
  'jpeg',
  'tiff',
  'tif',
  'bmp',
  'webp'
]
function isSupportedDocumentFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`))
}

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
      // Multi-format picker: dialog.showOpenDialog artık pdf+docx+pptx+html+md+image filtrelerini sunuyor
      const result = await selectPdf({ filterName: t('pdf_documents') })

      if (currentRequestId !== lastLoadRequestId.current || !result) return

      handleOpenPdfWithInfo(result)
    } catch (error) {
      if (currentRequestId === lastLoadRequestId.current) {
        Logger.error('[usePdfOpenActions] PDF Selection Error:', error)
      }
    }
  }, [selectPdf, t, handleOpenPdfWithInfo])

  // Alias for new multi-format handling – keeps backwards compat with handleSelectPdf
  const handleSelectDocument = handleSelectPdf

  const handlePdfDrop = useCallback(
    async (file: File) => {
      if (!isSupportedDocumentFileName(file.name)) {
        showError('error_invalid_pdf')
        return
      }

      const filePath = (file as DroppedPdfFile).path
      if (!filePath) return

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
        if (path) {
          showError('error_pdf_moved', undefined, { fileName: target.name })
          return 'not_found'
        }
        showError('error_pdf_load')
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
    handleSelectDocument,
    handlePdfDrop,
    resumeLastPdf,
    isSupportedDocumentFileName
  }
}

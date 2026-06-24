import { usePdfSelection } from '@features/pdf'

import { useTextSelection } from '@app/hooks/useTextSelection'
import { getElectronApi } from '@shared/lib/electronApi'
import { Logger } from '@shared/lib/logger'

import { type DragEvent, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface UsePdfWorkspaceStateParams {
  isInteractionBlocked: boolean
  isPanelResizing: boolean
}

export function usePdfWorkspaceState({
  isInteractionBlocked,
  isPanelResizing
}: UsePdfWorkspaceStateParams) {
  const { t } = useTranslation()
  const {
    pdfFile,
    pdfTabs,
    activePdfTab,
    activePdfTabId,
    setActivePdfTab,
    closePdfTab,
    renamePdfTab,
    handleSelectPdf,
    handlePdfDrop,
    updateReadingProgress,
    resumeLastPdf,
    recentReadingInfo,
    clearLastReading,
    restoreRecentReading,
    addEmptyPdfTab,
    activeTabInitialPage,
    goToPdfHome,
    openPdfInTab,
    upsertLastReadingInfo
  } = usePdfSelection()
  const { handleTextSelection } = useTextSelection()

  const lastReadingInfoRef = useRef(recentReadingInfo)
  lastReadingInfoRef.current = recentReadingInfo

  const handleResumePdf = useCallback(
    async (path?: string) => {
      const current = lastReadingInfoRef.current
      const target = path ? current.find((entry) => entry.path === path) : current[0]

      if (target) {
        return await resumeLastPdf(target.path)
      }

      return await resumeLastPdf(path)
    },
    [resumeLastPdf]
  )

  const handleClearResumePdf = useCallback(
    (path?: string) => {
      clearLastReading(path)
    },
    [clearLastReading]
  )

  const handleRelinkPdf = useCallback(
    async (oldPath: string): Promise<boolean> => {
      const current = lastReadingInfoRef.current
      const target = current.find((entry) => entry.path === oldPath)
      if (!target) return false

      try {
        const api = getElectronApi()
        if (!api) return false
        const result = await api.selectPdf({ filterName: 'PDF Documents' })
        if (!result) return false

        const stats = await api.getPdfStreamUrl(result.path).catch(() => null)
        if (!stats) {
          const registerResult = await api.registerPdfPath(result.path)
          if (!registerResult) return false
        }

        const nameMatch =
          result.name.toLowerCase().includes(target.name.toLowerCase().replace('.pdf', '')) ||
          target.name.toLowerCase().includes(result.name.toLowerCase().replace('.pdf', ''))

        if (!nameMatch) {
          const confirm = window.confirm(
            t('relink_file_mismatch')
              .replace('{original}', target.name)
              .replace('{new}', result.name)
          )
          if (!confirm) return false
        }

        upsertLastReadingInfo({
          ...target,
          path: result.path,
          name: result.name || target.name,
          lastOpenedAt: Date.now()
        })

        openPdfInTab({
          ...result,
          name: result.name || target.name
        })

        return true
      } catch (error) {
        Logger.error('[usePdfWorkspaceState] Relink Error:', error)
        return false
      }
    },
    [upsertLastReadingInfo, openPdfInTab, t]
  )

  const leftPanelProps = useMemo(
    () => ({
      onPdfDrop: handlePdfDrop,
      pdfFile,
      onSelectPdf: handleSelectPdf,
      onTextSelection: handleTextSelection,
      activePdfTab,
      pdfTabs,
      activePdfTabId,
      onSetActivePdfTab: setActivePdfTab,
      onClosePdfTab: closePdfTab,
      onRenamePdfTab: renamePdfTab,
      onAddEmptyPdfTab: addEmptyPdfTab,
      onPdfHome: goToPdfHome
    }),
    [
      handlePdfDrop,
      pdfFile,
      handleSelectPdf,
      handleTextSelection,
      activePdfTab,
      pdfTabs,
      activePdfTabId,
      setActivePdfTab,
      closePdfTab,
      renamePdfTab,
      addEmptyPdfTab,
      goToPdfHome
    ]
  )

  const readingProps = useMemo(
    () => ({
      onReadingProgressChange: updateReadingProgress,
      onResumePdf: handleResumePdf,
      onClearResumePdf: handleClearResumePdf,
      onRestoreResumePdf: restoreRecentReading,
      onRelinkPdf: handleRelinkPdf,
      initialPage: activeTabInitialPage
    }),
    [
      updateReadingProgress,
      handleResumePdf,
      handleClearResumePdf,
      restoreRecentReading,
      handleRelinkPdf,
      activeTabInitialPage
    ]
  )

  const handleRootDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }, [])

  const handleRootDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        void handlePdfDrop(event.dataTransfer.files[0])
      }
    },
    [handlePdfDrop]
  )

  const rootDragHandlers = useMemo(
    () => ({
      onDragOver: handleRootDragOver,
      onDrop: handleRootDrop
    }),
    [handleRootDragOver, handleRootDrop]
  )

  return useMemo(
    () => ({
      t,
      leftPanelProps,
      readingProps,
      rootDragHandlers,
      isInteractionBlocked,
      isPanelResizing
    }),
    [t, leftPanelProps, readingProps, rootDragHandlers, isInteractionBlocked, isPanelResizing]
  )
}

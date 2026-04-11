import { useCallback, useMemo, type ComponentProps, type DragEvent } from 'react'
import { useLanguageStrings } from '@app/providers'
import { useTextSelection } from '@app/hooks/useTextSelection'
import { usePdfSelection } from '@features/pdf'
import LeftPanel from '@ui/layout/LeftPanel'

interface UsePdfWorkspaceStateParams {
  isInteractionBlocked: boolean
  /** True while dragging the center hub to resize panels — PDF refit pauses to avoid loader flash. */
  isPanelResizing: boolean
}

export function usePdfWorkspaceState({
  isInteractionBlocked,
  isPanelResizing
}: UsePdfWorkspaceStateParams) {
  const { t } = useLanguageStrings()
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
    openGoogleDriveTab,
    activeTabInitialPage,
    goToPdfHome
  } = usePdfSelection()
  const { handleTextSelection } = useTextSelection()

  const lastReadingInfo = recentReadingInfo

  const handleResumePdf = useCallback(
    async (path?: string) => {
      const target = path ? lastReadingInfo.find((item) => item.path === path) : lastReadingInfo[0]

      if (target) {
        return await resumeLastPdf(target.path)
      }

      return await resumeLastPdf(path)
    },
    [lastReadingInfo, resumeLastPdf]
  )

  const leftPanelProps = useMemo<ComponentProps<typeof LeftPanel>>(
    () => ({
      onPdfDrop: handlePdfDrop,
      pdfFile,
      onSelectPdf: handleSelectPdf,
      onTextSelection: handleTextSelection,
      onResumePdf: handleResumePdf,
      onClearResumePdf: (path?: string) => clearLastReading(path),
      onRestoreResumePdf: restoreRecentReading,
      onReadingProgressChange: updateReadingProgress,
      lastReadingInfo,
      initialPage: activeTabInitialPage,
      activePdfTab,
      pdfTabs,
      activePdfTabId,
      onSetActivePdfTab: setActivePdfTab,
      onClosePdfTab: closePdfTab,
      onRenamePdfTab: renamePdfTab,
      onAddEmptyPdfTab: addEmptyPdfTab,
      onOpenGoogleDrive: openGoogleDriveTab,
      onPdfHome: goToPdfHome,
      isInteractionBlocked,
      isPanelResizing
    }),
    [
      handlePdfDrop,
      pdfFile,
      handleSelectPdf,
      handleTextSelection,
      handleResumePdf,
      clearLastReading,
      restoreRecentReading,
      updateReadingProgress,
      recentReadingInfo,
      activeTabInitialPage,
      activePdfTab,
      pdfTabs,
      activePdfTabId,
      setActivePdfTab,
      closePdfTab,
      renamePdfTab,
      addEmptyPdfTab,
      openGoogleDriveTab,
      goToPdfHome,
      isInteractionBlocked,
      isPanelResizing
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
      pdfFile,
      leftPanelProps,
      rootDragHandlers
    }),
    [t, pdfFile, leftPanelProps, rootDragHandlers]
  )
}

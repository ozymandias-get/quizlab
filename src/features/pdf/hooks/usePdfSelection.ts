import { useMemo, useCallback } from 'react'

import { usePdfTabStore } from './usePdfTabStore'
import { useReadingProgressPersistence } from './useReadingProgressPersistence'
import { usePdfOpenActions } from './usePdfOpenActions'

export * from './types'

export const usePdfSelection = () => {
  const {
    pdfTabs,
    activePdfTabId,
    activePdfTab,
    pdfFile,
    setActivePdfTab: rawSetActivePdfTab,
    openPdfInTab,
    closePdfTab,
    addEmptyPdfTab,
    goToPdfHome,
    openGoogleDriveTab,
    renamePdfTab
  } = usePdfTabStore()

  const {
    recentReadingInfo,
    recentReadingInfoRef,
    getLastReadingInfo,
    getRecentReadingInfo,
    updateReadingProgress,
    upsertLastReadingInfo,
    flushPendingReadingProgress,
    clearLastReading,
    restoreRecentReading
  } = useReadingProgressPersistence()

  const { handleSelectPdf, handlePdfDrop, resumeLastPdf } = usePdfOpenActions({
    openPdfInTab,
    upsertLastReadingInfo,
    flushPendingReadingProgress,
    recentReadingInfoRef
  })

  // Provide enhanced setActivePdfTab that triggers history timestamp updates
  const setActivePdfTab = useCallback(
    (tabId: string) => {
      rawSetActivePdfTab(tabId)
      const tab = pdfTabs.find((item) => item.id === tabId)
      if (tab?.file?.path && tab?.file?.name) {
        updateReadingProgress({
          path: tab.file.path,
          lastOpenedAt: Date.now()
        })
      }
    },
    [rawSetActivePdfTab, pdfTabs, updateReadingProgress]
  )

  const activeTabInitialPage = useMemo(() => {
    if (!activePdfTabId) return undefined
    if (activePdfTab?.kind !== 'pdf' || !activePdfTab?.file?.path) return undefined

    const existing = recentReadingInfo.find((item) => item.path === activePdfTab.file?.path)
    return existing?.page
  }, [activePdfTabId, activePdfTab, recentReadingInfo])

  return {
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
    getLastReadingInfo,
    getRecentReadingInfo,
    clearLastReading,
    restoreRecentReading,
    addEmptyPdfTab,
    openGoogleDriveTab,
    activeTabInitialPage,
    goToPdfHome,
    recentReadingInfo
  }
}

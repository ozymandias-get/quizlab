import { useCallback, useMemo } from 'react'

import { usePdfOpenActions } from './usePdfOpenActions'
import { usePdfTabState, usePdfTabStore } from './usePdfTabStore'
import { useReadingProgressPersistence } from './useReadingProgressPersistence'

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
  } = usePdfTabState()

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
  // Uses usePdfTabStore.getState() to read live state instead of closure
  // variables, preventing stale reads when closePdfTab + setActivePdfTab
  // both fire in the same event tick (e.g. event propagation edge case).
  const setActivePdfTab = useCallback(
    (tabId: string) => {
      const { activePdfTabId: currentActiveId, pdfTabs: currentTabs } = usePdfTabStore.getState()
      if (currentActiveId === tabId) return
      rawSetActivePdfTab(tabId)
      const tab = (currentTabs || []).find((item) => item.id === tabId)
      if (tab?.file?.path && tab?.file?.name) {
        updateReadingProgress({
          path: tab.file.path,
          lastOpenedAt: Date.now()
        })
      }
    },
    [rawSetActivePdfTab, updateReadingProgress]
  )

  const activeTabInitialPage = useMemo(() => {
    if (!activePdfTabId) return undefined
    if (activePdfTab?.kind !== 'pdf' || !activePdfTab?.file) return undefined

    const file = activePdfTab.file
    if (file.path) {
      const existing = (recentReadingInfo || []).find((item) => item.path === file.path)
      return existing?.page
    }
    return undefined
  }, [activePdfTabId, activePdfTab, recentReadingInfo])

  return useMemo(
    () => ({
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
      openPdfInTab,
      upsertLastReadingInfo,
      goToPdfHome,
      recentReadingInfo
    }),
    [
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
      openPdfInTab,
      upsertLastReadingInfo,
      goToPdfHome,
      recentReadingInfo
    ]
  )
}

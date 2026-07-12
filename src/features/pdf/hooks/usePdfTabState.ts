import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { usePdfTabStore } from './usePdfTabStore'

/**
 * Backwards-compatible hook that returns the PDF tab state with derived
 * `activeTab` and `pdfFile` values, matching the previous useState-based API.
 */
export function usePdfTabState() {
  const { pdfTabs, activePdfTabId } = usePdfTabStore(
    useShallow((s) => ({
      pdfTabs: s.pdfTabs,
      activePdfTabId: s.activePdfTabId
    }))
  )
  const setActivePdfTab = usePdfTabStore((s) => s.setActivePdfTab)
  const openPdfInTab = usePdfTabStore((s) => s.openPdfInTab)
  const closePdfTab = usePdfTabStore((s) => s.closePdfTab)
  const addEmptyPdfTab = usePdfTabStore((s) => s.addEmptyPdfTab)
  const goToPdfHome = usePdfTabStore((s) => s.goToPdfHome)
  const openGoogleDriveTab = usePdfTabStore((s) => s.openGoogleDriveTab)
  const renamePdfTab = usePdfTabStore((s) => s.renamePdfTab)

  const activeTab = useMemo(() => {
    if (!activePdfTabId) return null
    return pdfTabs.find((tab) => tab.id === activePdfTabId) || null
  }, [pdfTabs, activePdfTabId])

  const pdfFile = useMemo(() => {
    return activeTab?.kind === 'drive' ? null : activeTab?.file || null
  }, [activeTab])

  return useMemo(
    () => ({
      pdfTabs,
      activePdfTabId,
      activePdfTab: activeTab,
      pdfFile,
      setActivePdfTab,
      openPdfInTab,
      closePdfTab,
      addEmptyPdfTab,
      goToPdfHome,
      openGoogleDriveTab,
      renamePdfTab
    }),
    [
      pdfTabs,
      activePdfTabId,
      activeTab,
      pdfFile,
      setActivePdfTab,
      openPdfInTab,
      closePdfTab,
      addEmptyPdfTab,
      goToPdfHome,
      openGoogleDriveTab,
      renamePdfTab
    ]
  )
}

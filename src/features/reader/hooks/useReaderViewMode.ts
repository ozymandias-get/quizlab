import type { ReaderViewMode } from '@features/pdf/hooks/types'
import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'

import { useCallback } from 'react'

export function useReaderViewMode(activeTabId: string | undefined) {
  const viewMode = usePdfTabStore((s) => {
    const tab = s.pdfTabs.find((t) => t.id === activeTabId)
    return (tab?.viewMode ?? 'pdf') as ReaderViewMode
  })
  const setPdfViewMode = usePdfTabStore((s) => s.setPdfViewMode)

  const setViewMode = useCallback(
    (mode: ReaderViewMode) => {
      if (!activeTabId) return
      setPdfViewMode(activeTabId, mode)
    },
    [activeTabId, setPdfViewMode]
  )

  return { viewMode, setViewMode }
}

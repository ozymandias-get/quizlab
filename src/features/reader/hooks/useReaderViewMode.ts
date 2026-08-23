import type { ReaderViewMode } from '@features/pdf/hooks/types'
import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'

import { useCallback } from 'react'

export function useReaderViewMode(activeTabId: string | undefined) {
  const viewMode = usePdfTabStore((s) => {
    const tab = s.pdfTabs.find((t) => t.id === activeTabId)
    return (tab?.viewMode ?? 'pdf') as ReaderViewMode
  })
  const setPdfViewMode = usePdfTabStore((s) => s.setPdfViewMode)

  // DEBUG: trace viewMode reads
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.debug(
      `[ReaderDebug] useReaderViewMode tab=${activeTabId ?? 'none'} -> viewMode=${viewMode}`
    )
  }

  const setViewMode = useCallback(
    (mode: ReaderViewMode) => {
      if (!activeTabId) {
        // eslint-disable-next-line no-console
        console.debug(`[ReaderDebug] setViewMode ignored (no activeTab) -> ${mode}`)
        return
      }
      // eslint-disable-next-line no-console
      console.debug(`[ReaderDebug] setViewMode tab=${activeTabId} ${viewMode} -> ${mode}`)
      setPdfViewMode(activeTabId, mode)
    },
    [activeTabId, setPdfViewMode, viewMode]
  )

  return { viewMode, setViewMode }
}

import { useCallback, useEffect } from 'react'

import { useOcrStore } from '../store/useOcrStore'
import { useOcrActions } from './useOcrActions'

export function useOcrPanelController(
  pdfFile: {
    path?: string | null
    streamUrl?: string | null
    name?: string | null
    size?: number | null
  } | null,
  _pdfUrl?: string | null,
  _currentPage?: number
) {
  const isPanelOpen = useOcrStore((s) => s.isPanelOpen)
  const status = useOcrStore((s) => s.status)
  const result = useOcrStore((s) => s.result)
  const error = useOcrStore((s) => s.error)
  const currentPage = useOcrStore((s) => s.currentPage)
  const closePanel = useOcrStore((s) => s.closePanel)
  const { cancel } = useOcrActions()

  const handleClose = useCallback(() => {
    // Cancel in-flight if closing while loading
    if (
      status === 'processing' ||
      status === 'rendering-page' ||
      status === 'initializing-engine'
    ) {
      cancel()
    }
    closePanel()
  }, [cancel, closePanel, status])

  // Auto-close panel when document changes to avoid stale results showing for new doc
  useEffect(() => {
    const docId = pdfFile?.path || pdfFile?.streamUrl || pdfFile?.name || null
    const storeDocId = useOcrStore.getState().currentDocumentId
    if (
      docId &&
      storeDocId &&
      docId !== storeDocId &&
      !docId.includes(storeDocId) &&
      !storeDocId.includes(docId)
    ) {
      // Different document — if panel open with success for old doc, keep but stale check will hide?
      // Instead we just keep; cancel any in-flight for old doc
      const s = useOcrStore.getState().status
      if (s === 'processing' || s === 'rendering-page' || s === 'initializing-engine') {
        cancel()
      }
    }
  }, [pdfFile?.name, pdfFile?.path, pdfFile?.streamUrl, cancel])

  return { isPanelOpen, status, result, error, currentPage, handleClose }
}

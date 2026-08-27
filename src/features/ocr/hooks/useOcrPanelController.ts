import { useCallback, useEffect, useRef } from 'react'

import { createDocumentFingerprint } from '../lib/cacheKey'
import { cancelActiveJob } from '../lib/ocrJobManager'
import { getActivePdfDocumentFingerprint } from '../lib/renderPageToImage'
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
  const prevFingerprintRef = useRef<string | null>(null)
  const { cancel } = useOcrActions()

  const handleClose = useCallback(() => {
    if (
      status === 'processing' ||
      status === 'rendering-page' ||
      status === 'initializing-engine'
    ) {
      void cancelActiveJob()
      cancel()
    }
    closePanel()
  }, [cancel, closePanel, status])

  // Robust document identity: prefer pdf fingerprint when available, else same algorithm as cacheKey

  useEffect(() => {
    if (!pdfFile) {
      prevFingerprintRef.current = null
      return
    }
    const pdfFp = getActivePdfDocumentFingerprint()
    const nextFingerprint = createDocumentFingerprint({
      path: pdfFile.path ?? null,
      name: pdfFile.name ?? null,
      size: pdfFile.size ?? null,
      streamUrl: pdfFile.streamUrl ?? null,
      pdfFingerprint: pdfFp
    })
    const prev = prevFingerprintRef.current
    prevFingerprintRef.current = nextFingerprint

    if (!prev) return
    if (prev === nextFingerprint) return

    // Document truly changed — invariant: cancel any in-flight, clear transient result, close panel, bump token, cancel area selection
    const s = useOcrStore.getState()
    const isProcessing =
      s.status === 'processing' ||
      s.status === 'rendering-page' ||
      s.status === 'initializing-engine'
    if (isProcessing) {
      void cancelActiveJob()
    }
    // Clear area selection if active
    if (s.isAreaSelectionActive) {
      s.cancelAreaSelection()
    }
    // Clear transient result so PDF A's text never shows on PDF B (P0-4 privacy/isolation)
    s.clearTransientResult()
    // Close panel
    s.closePanel()
    // Bump token so any late completion is discarded
    s.bumpToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfFile?.name, pdfFile?.path, pdfFile?.streamUrl, pdfFile?.size])

  return { isPanelOpen, status, result, error, currentPage, handleClose }
}

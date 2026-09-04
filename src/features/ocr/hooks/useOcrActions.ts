import { Logger } from '@shared/lib/logger'

import { useCallback } from 'react'

import { createDocumentFingerprint, createOcrCacheKey } from '../lib/cacheKey'
import { ocrCache } from '../lib/ocrCache'
import { cancelActiveJob } from '../lib/ocrJobManager'
import { HYBRID_ENGINE_NAME } from '../providers/hybridProvider'
import { useOcrStore } from '../store/useOcrStore'
import type { OcrPdfFile } from '../types'
import { useOcrAreaScan } from './useOcrAreaScan'
import { useOcrPageScan } from './useOcrPageScan'

/**
 * Facade over the OCR scan flows — public API is unchanged
 * (`{ processPage, processArea, cancel, retry }`).
 *
 * Flow implementations live in focused hooks:
 * - `useOcrPageScan` — document page OCR (cache + render fallback)
 * - `useOcrAreaScan` — region capture OCR (snapshot validation)
 * Only cross-flow concerns (`cancel`, `retry`) stay here.
 */
export function useOcrActions() {
  const { processPage } = useOcrPageScan()
  const { processArea } = useOcrAreaScan()

  const cancel = useCallback(() => {
    void cancelActiveJob()
    Logger.info('[OCR] cancelled via useOcrActions')
  }, [])

  const retry = useCallback(
    async (params?: { pageNumber?: number; pdfFile?: OcrPdfFile; pdfUrl?: string | null }) => {
      const s = useOcrStore.getState()
      const page = params?.pageNumber ?? s.currentPage
      const file = params?.pdfFile ?? null
      const url = params?.pdfUrl ?? null
      if (page == null || !file) {
        Logger.warn('[OCR] retry called without page/file context')
        return null
      }
      Logger.info(`[OCR] retry page ${page}`)
      // On retry, clear cache for that page to force re-run
      try {
        const fp = createDocumentFingerprint(file)
        const cfg = s.config
        const key = createOcrCacheKey({
          fingerprint: fp,
          pageNumber: page,
          engine: HYBRID_ENGINE_NAME,
          config: cfg
        })
        ocrCache.delete(key)
      } catch {}
      return processPage({ pageNumber: page, pdfFile: file, pdfUrl: url })
    },
    [processPage]
  )

  return { processPage, processArea, cancel, retry }
}

/**
 * Hybrid provider: native text first, OCR second (unless forceOcr).
 * Implements the spec: PDF.js text layer check → native text + layout reconstruction,
 * otherwise real OCR → structured Markdown + LaTeX.
 */
import { Logger } from '@shared/lib/logger'

import type { OcrPageResult, OcrProvider } from '../types'
import { createNativeTextProvider, NATIVE_TEXT_ENGINE_NAME } from './nativeTextProvider'
import { createTesseractProvider, TESSERACT_ENGINE_NAME } from './tesseractProvider'

export const HYBRID_ENGINE_NAME = 'hybrid' as const

export function createHybridProvider(): OcrProvider {
  const native = createNativeTextProvider()
  const tesseract = createTesseractProvider()

  return {
    name: HYBRID_ENGINE_NAME,
    version: native.version,

    async initialize(config, signal) {
      if (config.forceOcr) {
        // Directly init OCR
        await tesseract.initialize(config, signal)
        return
      }
      await native.initialize(config, signal)
      // Lazily pre-init OCR in background without blocking
      // Only if not already cached
      void tesseract.initialize(config, signal).catch(() => {})
    },

    async processPage(job, imageData) {
      // If forceOcr requested, go straight to OCR
      if (job.config.forceOcr) {
        Logger.debug(`[OCR:hybrid] forceOcr page ${job.pageNumber} → tesseract`)
        try {
          return await tesseract.processPage(job, imageData)
        } catch (e) {
          // If tesseract not available, degrade to native attempt
          const msg = (e as Error).message
          if (msg === 'TESSERACT_NOT_AVAILABLE') {
            Logger.warn('[OCR:hybrid] tesseract not available, falling back to native')
            return native.processPage(job, imageData)
          }
          throw e
        }
      }

      // Try native first unless image explicitly indicates scanned
      try {
        const nativeResult = await native.processPage(job, imageData)
        // Heuristic: if native text is very short vs expected page density, treat as scanned
        // We don't have expected density, so just trust native if length > 50 already validated inside provider.
        // For academic two-column, native provider already does column ordering.
        Logger.debug(
          `[OCR:hybrid] page ${job.pageNumber} served via native-text (${nativeResult.plainText.length} chars)`
        )
        return nativeResult
      } catch (e) {
        const msg = (e as Error).message
        if (msg !== 'NO_NATIVE_TEXT') {
          // Unexpected native error — propagate
          if ((e as DOMException).name === 'AbortError') throw e
          Logger.warn('[OCR:hybrid] native provider error, trying OCR', e)
        } else {
          Logger.debug(`[OCR:hybrid] page ${job.pageNumber} native miss → OCR`)
        }

        // Fall back to OCR
        try {
          const ocrResult = await tesseract.processPage(job, imageData)
          // Mark hybrid source but keep engine name as tesseract for cache discrimination?
          // Keep original engine for precise invalidation; hybrid callers can inspect isNativeText.
          return ocrResult
        } catch (ocrErr) {
          const ocrMsg = (ocrErr as Error).message
          if (ocrMsg === 'TESSERACT_NOT_AVAILABLE' || ocrMsg === 'NO_TEXT_RECOGNIZED') {
            // No OCR runtime available and no native text — produce empty structured result
            // rather than crashing UX; caller can show "no text found" state.
            Logger.warn(
              '[OCR:hybrid] OCR unavailable and no native text — returning empty result',
              ocrErr
            )
            const empty: OcrPageResult = {
              pageNumber: job.pageNumber,
              documentId: job.documentId,
              markdown:
                '_No selectable text found on this page. Try Force OCR or use a searchable PDF._',
              plainText: '',
              language: job.config.language,
              blocks: [],
              tables: [],
              formulas: [],
              engine: NATIVE_TEXT_ENGINE_NAME,
              engineVersion: native.version,
              createdAt: Date.now(),
              config: job.config,
              isNativeText: true,
              readingOrder: 'unknown'
            }
            return empty
          }
          throw ocrErr
        }
      }
    },

    async dispose() {
      await Promise.allSettled([native.dispose(), tesseract.dispose()])
    },

    getCapabilities() {
      // Union of both
      const n = native.getCapabilities()
      const t = tesseract.getCapabilities()
      return {
        supportsTables: n.supportsTables || t.supportsTables,
        supportsFormulas: n.supportsFormulas || t.supportsFormulas,
        supportsLatex: n.supportsLatex || t.supportsLatex,
        supportsLayout: true,
        supportedLanguages: ['auto', 'tr', 'en']
      }
    }
  }
}

export const ocrEngineDisplayNames: Record<string, string> = {
  [NATIVE_TEXT_ENGINE_NAME]: 'Native',
  [TESSERACT_ENGINE_NAME]: 'Tesseract',
  [HYBRID_ENGINE_NAME]: 'Hybrid'
}

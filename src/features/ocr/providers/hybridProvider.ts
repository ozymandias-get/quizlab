/**
 * Hybrid provider: native text first, OCR second (unless forceOcr).
 */
import { Logger } from '@shared/lib/logger'

import type { OcrProvider } from '../types'
import { OcrError } from '../types'
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
        await tesseract.initialize(config, signal)
        return
      }
      await native.initialize(config, signal)
    },

    async processPage(job, imageData) {
      // Region jobs: strict image-only path — never fallback to full-page native text (P0-5)
      if (job.kind === 'region') {
        Logger.debug(`[OCR:hybrid] region job page ${job.pageNumber} → tesseract only`)
        try {
          const ocrResult = await tesseract.processPage(job, imageData)
          return ocrResult
        } catch (e) {
          if (e instanceof OcrError && e.code === 'TESSERACT_NOT_AVAILABLE') {
            // Do not fallback to native full-page — propagate as engine unavailable
            throw e
          }
          if (e instanceof OcrError && e.code === 'NO_TEXT_RECOGNIZED') {
            throw e
          }
          throw e
        }
      }

      if (job.config.forceOcr) {
        Logger.debug(`[OCR:hybrid] forceOcr page ${job.pageNumber} → tesseract`)
        try {
          return await tesseract.processPage(job, imageData)
        } catch (e) {
          const code =
            e instanceof OcrError ? e.code : e instanceof Error ? e.message : String(e ?? '')
          if (code === 'TESSERACT_NOT_AVAILABLE') {
            Logger.warn('[OCR:hybrid] tesseract not available, falling back to native')
            return native.processPage(job, imageData)
          }
          throw e
        }
      }

      try {
        const nativeResult = await native.processPage(job, imageData)
        Logger.debug(
          `[OCR:hybrid] page ${job.pageNumber} served via native-text (${nativeResult.plainText.length} chars)`
        )
        return nativeResult
      } catch (e) {
        const code =
          e instanceof OcrError ? e.code : e instanceof Error ? e.message : String(e ?? '')
        if (code !== 'NO_NATIVE_TEXT') {
          if ((e as DOMException).name === 'AbortError') throw e
          if (e instanceof OcrError) throw e
          Logger.warn('[OCR:hybrid] native provider error, trying OCR', e)
        } else {
          Logger.debug(`[OCR:hybrid] page ${job.pageNumber} native miss → OCR`)
        }

        const isEmptyImage =
          !imageData ||
          (typeof imageData === 'string' && imageData.trim() === '') ||
          (imageData instanceof Blob && imageData.size === 0)
        if (isEmptyImage) {
          throw new OcrError('NO_NATIVE_TEXT')
        }
        try {
          const ocrResult = await tesseract.processPage(job, imageData)
          return ocrResult
        } catch (ocrErr) {
          const ocrCode =
            ocrErr instanceof OcrError
              ? ocrErr.code
              : ocrErr instanceof Error
                ? ocrErr.message
                : String(ocrErr ?? '')
          if (ocrCode === 'TESSERACT_NOT_AVAILABLE' || ocrCode === 'NO_TEXT_RECOGNIZED') {
            // Map to typed outcomes instead of fake success (P1-13)
            if (ocrCode === 'TESSERACT_NOT_AVAILABLE') {
              throw new OcrError('TESSERACT_NOT_AVAILABLE', 'Engine unavailable')
            }
            throw new OcrError('NO_TEXT_RECOGNIZED', 'No text recognized')
          }
          throw ocrErr
        }
      }
    },

    async dispose() {
      await Promise.allSettled([native.dispose(), tesseract.dispose()])
    },

    getCapabilities() {
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

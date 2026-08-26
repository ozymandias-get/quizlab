import { extractPageTextFromDom } from '@features/pdf/text/extractPageTextFromDom'

import { Logger } from '@shared/lib/logger'

import { normalizeToMarkdown } from '../lib/markdownNormalizer'
import type { OcrConfig, OcrPageResult, OcrProvider, OcrProviderCapabilities } from '../types'
import { OCR_ENGINE_VERSION } from '../types'

export const NATIVE_TEXT_ENGINE_NAME = 'native-text' as const

export function createNativeTextProvider(): OcrProvider {
  let initialized = false

  return {
    name: NATIVE_TEXT_ENGINE_NAME,
    version: OCR_ENGINE_VERSION,

    async initialize(_config: OcrConfig, _signal?: AbortSignal): Promise<void> {
      initialized = true
    },

    async processPage(job, _imageData): Promise<OcrPageResult> {
      if (!initialized) await Promise.resolve()

      if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      const raw = extractPageTextFromDom(job.pageNumber)

      if (!raw || raw.trim().length < 10) {
        // No usable native text — signal caller to fall back to OCR
        throw new Error('NO_NATIVE_TEXT')
      }

      if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      const { markdown, plainText, blocks, tables, formulas } = normalizeToMarkdown(raw)

      Logger.debug(`[OCR:native] page ${job.pageNumber} native text extracted`, {
        length: plainText.length
      })

      return {
        pageNumber: job.pageNumber,
        documentId: job.documentId,
        markdown,
        plainText,
        language: job.config.language,
        blocks,
        tables,
        formulas,
        engine: NATIVE_TEXT_ENGINE_NAME,
        engineVersion: OCR_ENGINE_VERSION,
        createdAt: Date.now(),
        config: job.config,
        isNativeText: true,
        readingOrder: blocks.length > 0 ? 'single-column' : 'unknown'
      }
    },

    async dispose(): Promise<void> {
      initialized = false
    },

    getCapabilities(): OcrProviderCapabilities {
      return {
        supportsTables: false,
        supportsFormulas: false,
        supportsLatex: false,
        supportsLayout: true,
        supportedLanguages: ['auto', 'tr', 'en']
      }
    }
  }
}

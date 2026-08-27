import { extractPageTextFromDom } from '@features/pdf/text/extractPageTextFromDom'

import { Logger } from '@shared/lib/logger'

import { normalizeToMarkdown } from '../lib/markdownNormalizer'
import type { OcrConfig, OcrPageResult, OcrProvider, OcrProviderCapabilities } from '../types'
import { getSensitivityPreset, OCR_ENGINE_VERSION, OcrError } from '../types'

export const NATIVE_TEXT_ENGINE_NAME = 'native-text' as const

function isNativeTextUsable(raw: string | null, sensitivity: OcrConfig['sensitivity']): boolean {
  if (!raw) return false
  const trimmed = raw.trim()
  if (trimmed.length === 0) return false
  const preset = getSensitivityPreset(sensitivity)

  // Threshold 1: character count — previous fixed <10 allowed 12-char footer to count as native page; now sensitivity-aware
  if (trimmed.length < preset.nativeMinChars) return false

  // Threshold 2: text blocks — split by lines/paragraphs with meaningful content
  const blocks = trimmed
    .split(/\n{1,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5)
  if (blocks.length < preset.nativeMinBlocks) {
    // Also consider density: if total chars is barely above threshold but only 1 short block, likely footer/watermark
    const avgBlockLen = blocks.length > 0 ? trimmed.length / blocks.length : 0
    if (avgBlockLen < 20) return false
    if (blocks.length < preset.nativeMinBlocks) return false
  }

  // Threshold 3: alphanumeric ratio — scanned page artifacts often have many symbols but few letters/digits
  const alnum = (trimmed.match(/\p{L}|\p{N}/gu) ?? []).length
  const ratio = alnum / Math.max(1, trimmed.length)
  if (ratio < 0.35) return false

  // Threshold 4: alphanumeric chars count — ensure we have substantial readable text, not just numbers like "12/132"
  const meaningfulChars = (trimmed.match(/\p{L}{2,}/gu) ?? []).join('').length
  if (meaningfulChars < Math.min(20, preset.nativeMinChars * 0.4)) return false

  // Threshold 5: coverage — if page has <2 lines of text spread across blocks, treat as scanned even if 15 chars footer present
  const nonEmptyLines = trimmed.split('\n').filter((l) => l.trim().length > 3).length
  if (nonEmptyLines < 2 && trimmed.length < 80) return false

  return true
}

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

      // Region jobs must never use native full-page text — they are cropped image selections
      if (job.kind === 'region') {
        throw new OcrError('NO_NATIVE_TEXT', 'Region OCR must not use native page text')
      }

      const raw = extractPageTextFromDom(job.pageNumber)

      if (!isNativeTextUsable(raw, job.config.sensitivity)) {
        throw new OcrError('NO_NATIVE_TEXT')
      }

      if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      const safeRaw = raw as string
      const { markdown, plainText, blocks, tables, formulas } = normalizeToMarkdown(safeRaw)

      Logger.debug(`[OCR:native] page ${job.pageNumber} native text extracted`, {
        length: plainText.length,
        blocks: blocks.length
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
        readingOrder: blocks.length > 0 ? 'single-column' : 'unknown',
        outcome: 'success'
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

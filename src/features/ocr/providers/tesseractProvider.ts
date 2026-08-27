import { Logger } from '@shared/lib/logger'

// Vite ?url import — bundles worker locally so CSP does not need to allow CDN for worker script.
// Using local worker avoids "script-src" violation for https://cdn.jsdelivr.net/.../worker.min.js
// and works offline (file://) via `workerBlobURL: false`.
import tesseractWorkerPath from 'tesseract.js/dist/worker.min.js?url'

import { normalizeToMarkdown } from '../lib/markdownNormalizer'
import type { OcrConfig, OcrPageResult, OcrProvider, OcrProviderCapabilities } from '../types'
import { OCR_ENGINE_VERSION } from '../types'

export const TESSERACT_ENGINE_NAME = 'tesseract' as const

type TesseractLike = {
  createWorker: (
    langs: string,
    oem?: number,
    opts?: unknown
  ) => Promise<{
    recognize: (
      image: string | Blob | HTMLCanvasElement,
      opts?: unknown,
      out?: unknown
    ) => Promise<{ data: { text: string; confidence: number } }>
    terminate: () => Promise<void>
  }>
}

let cachedWorker: Awaited<ReturnType<TesseractLike['createWorker']>> | null = null
let cachedLang: string | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null

function langForConfig(config: OcrConfig): string {
  if (config.language === 'tr') return 'tur'
  if (config.language === 'en') return 'eng'
  return 'eng+tur'
}

function scheduleIdleDispose(): void {
  if (idleTimer) clearTimeout(idleTimer)
  // Release after 5 min idle to free ~30MB WASM heap
  idleTimer = setTimeout(() => {
    void disposeWorker()
  }, 300_000)
}

async function disposeWorker(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  if (cachedWorker) {
    try {
      await cachedWorker.terminate()
    } catch (e) {
      Logger.warn('[OCR:tesseract] worker terminate failed', e)
    }
    cachedWorker = null
    cachedLang = null
  }
}

async function getOrCreateWorker(
  lang: string,
  signal?: AbortSignal
): Promise<ReturnType<TesseractLike['createWorker']> extends Promise<infer U> ? U : never> {
  if (cachedWorker && cachedLang === lang) {
    scheduleIdleDispose()
    return cachedWorker as never
  }
  if (cachedWorker) await disposeWorker()
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  let mod: TesseractLike | null = null
  try {
    // Lazy load — heavy WASM + ~10MB lang data; dynamically imported so main chunk stays small
    mod = (await import('tesseract.js')) as unknown as TesseractLike
  } catch (e) {
    Logger.warn(
      '[OCR:tesseract] dynamic import failed — tesseract.js not installed or failed to load',
      e
    )
    throw new Error('TESSERACT_NOT_AVAILABLE')
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // Try local worker first (bundled via Vite, allowed by 'self' CSP). Fallback to CDN default on failure.
  let worker: Awaited<ReturnType<TesseractLike['createWorker']>>
  const tesseractOpts = {
    workerPath: tesseractWorkerPath,
    workerBlobURL: false,
    // langPath defaults to jsDelivr CDN (now allowed via connect-src). Keep gzip/cache defaults.
    gzip: true,
    logger: () => {},
    errorHandler: (e: unknown) => Logger.warn('[OCR:tesseract] worker error', e)
    // cacheMethod 'write' allows IndexedDB caching of .traineddata to avoid re-download
  } as unknown as Record<string, unknown>
  try {
    worker = await mod.createWorker(lang, 1, tesseractOpts)
  } catch (err) {
    Logger.warn('[OCR:tesseract] local workerPath failed, retrying with default CDN worker', err)
    // Fallback: let tesseract.js use its default CDN workerPath (requires CSP allow cdn.jsdelivr.net)
    worker = await mod.createWorker(lang, 1, {
      logger: () => {},
      errorHandler: (e: unknown) => Logger.warn('[OCR:tesseract] worker error', e)
    } as unknown as Record<string, unknown>)
  }

  cachedWorker = worker as never
  cachedLang = lang
  scheduleIdleDispose()
  return worker as never
}

export function createTesseractProvider(): OcrProvider {
  return {
    name: TESSERACT_ENGINE_NAME,
    version: OCR_ENGINE_VERSION,

    async initialize(config, signal): Promise<void> {
      const lang = langForConfig(config)
      await getOrCreateWorker(lang, signal)
    },

    async processPage(job, imageData): Promise<OcrPageResult> {
      if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      const lang = langForConfig(job.config)
      let worker: Awaited<ReturnType<TesseractLike['createWorker']>>
      try {
        worker = (await getOrCreateWorker(lang, job.signal)) as Awaited<
          ReturnType<TesseractLike['createWorker']>
        >
      } catch (e) {
        // Tesseract not available — fallback error propagated to caller
        throw e
      }

      if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      // Normalize imageData to data URL or blob suitable for tesseract
      let imageForWorker: string | Blob
      if (typeof imageData === 'string') {
        imageForWorker = imageData
      } else if (imageData instanceof Blob) {
        imageForWorker = imageData
      } else if (imageData && typeof imageData === 'object' && 'data' in imageData) {
        // ImageData — convert to canvas blob
        const canvas = document.createElement('canvas')
        canvas.width = (imageData as ImageData).width
        canvas.height = (imageData as ImageData).height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D unavailable')
        ctx.putImageData(imageData as ImageData, 0, 0)
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob((b) => res(b), 'image/png')
        )
        if (!blob) throw new Error('Failed to convert ImageData to blob')
        imageForWorker = blob
      } else {
        throw new Error('Unsupported imageData type for Tesseract')
      }

      if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      const result = await worker.recognize(imageForWorker)

      if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      const rawText = result.data.text || ''
      if (!rawText.trim()) throw new Error('NO_TEXT_RECOGNIZED')

      const { markdown, plainText, blocks, tables, formulas } = normalizeToMarkdown(rawText)

      return {
        pageNumber: job.pageNumber,
        documentId: job.documentId,
        markdown,
        plainText,
        language: job.config.language,
        blocks,
        tables,
        formulas,
        engine: TESSERACT_ENGINE_NAME,
        engineVersion: OCR_ENGINE_VERSION,
        createdAt: Date.now(),
        config: job.config,
        isNativeText: false,
        readingOrder: 'unknown'
      }
    },

    async dispose(): Promise<void> {
      await disposeWorker()
    },

    getCapabilities(): OcrProviderCapabilities {
      return {
        supportsTables: false,
        supportsFormulas: false,
        supportsLatex: false,
        supportsLayout: false,
        supportedLanguages: ['auto', 'tr', 'en']
      }
    }
  }
}

export async function releaseTesseractIdle(): Promise<void> {
  await disposeWorker()
}

import { Logger } from '@shared/lib/logger'

// Vite ?url import — bundles worker locally so CSP does not need to allow CDN for worker script.
import tesseractWorkerPath from 'tesseract.js/dist/worker.min.js?url'

import { normalizeToMarkdown } from '../lib/markdownNormalizer'
import type { OcrConfig, OcrPageResult, OcrProvider, OcrProviderCapabilities } from '../types'
import {
  getSensitivityPreset,
  OCR_ENGINE_VERSION,
  OCR_IDLE_TIMEOUT_MS,
  OCR_TIMEOUT_MS,
  OcrError
} from '../types'

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
  idleTimer = setTimeout(() => {
    void disposeWorker()
  }, OCR_IDLE_TIMEOUT_MS)
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

/**
 * Forcefully terminate the active worker — used by cancel/timeout to truly stop WASM computation
 * and free the queue slot (P0-3).
 */
export async function forceTerminateWorker(): Promise<void> {
  await disposeWorker()
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
    mod = (await import('tesseract.js')) as unknown as TesseractLike
  } catch (e) {
    Logger.warn(
      '[OCR:tesseract] dynamic import failed — tesseract.js not installed or failed to load',
      e
    )
    throw new OcrError('TESSERACT_NOT_AVAILABLE')
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  let worker: Awaited<ReturnType<TesseractLike['createWorker']>>
  const tesseractOpts = {
    workerPath: tesseractWorkerPath,
    workerBlobURL: false,
    gzip: true,
    logger: () => {},
    errorHandler: (e: unknown) => Logger.warn('[OCR:tesseract] worker error', e)
  } as unknown as Record<string, unknown>
  try {
    worker = await mod.createWorker(lang, 1, tesseractOpts)
  } catch (err) {
    Logger.warn('[OCR:tesseract] local workerPath failed, retrying with default CDN worker', err)
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
        throw e
      }

      if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      let imageForWorker: string | Blob
      if (typeof imageData === 'string') {
        imageForWorker = imageData
      } else if (imageData instanceof Blob) {
        imageForWorker = imageData
      } else if (imageData && typeof imageData === 'object' && 'data' in imageData) {
        const canvas = document.createElement('canvas')
        canvas.width = (imageData as ImageData).width
        canvas.height = (imageData as ImageData).height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new OcrError('OCR_FAILED', 'Canvas 2D unavailable')
        ctx.putImageData(imageData as ImageData, 0, 0)
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob((b) => res(b), 'image/png')
        )
        if (!blob) throw new OcrError('OCR_FAILED', 'Failed to convert ImageData to blob')
        imageForWorker = blob
      } else {
        throw new OcrError('OCR_FAILED', 'Unsupported imageData type for Tesseract')
      }

      if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      // Race recognize against abort signal and timeout (P0-3 timeout must actually terminate worker)
      const timeoutMs = OCR_TIMEOUT_MS
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      let abortHandler: (() => void) | null = null

      const abortPromise = new Promise<never>((_, reject) => {
        if (job.signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        abortHandler = () => {
          // Terminate WASM worker so the slot is freed promptly
          void forceTerminateWorker()
          reject(new DOMException('Aborted', 'AbortError'))
        }
        job.signal.addEventListener('abort', abortHandler, { once: true })
      })

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          void forceTerminateWorker()
          reject(new OcrError('TIMEOUT', `OCR timeout after ${timeoutMs}ms`))
        }, timeoutMs)
      })

      let rawText = ''
      let confidence = 0
      try {
        const result = (await Promise.race([
          worker.recognize(imageForWorker),
          abortPromise,
          timeoutPromise
        ])) as { data: { text: string; confidence: number } }
        rawText = result.data.text || ''
        confidence = result.data.confidence ?? 0
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        if (abortHandler) job.signal.removeEventListener('abort', abortHandler)
      }

      if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      if (!rawText.trim()) throw new OcrError('NO_TEXT_RECOGNIZED')

      // Apply sensitivity-based confidence gating (P1-10)
      const sensitivityPreset = getSensitivityPreset(job.config.sensitivity)
      if (confidence > 0 && confidence < sensitivityPreset.confidenceThreshold) {
        // Low confidence — depending on sensitivity, treat as no-text to allow retry or fallback handling
        // For low sensitivity we keep result anyway; for medium/high we throw to let hybrid decide
        if (job.config.sensitivity === 'high') {
          throw new OcrError('NO_TEXT_RECOGNIZED', `Low confidence ${confidence}`)
        }
      }

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
        readingOrder: 'unknown',
        outcome: 'success',
        confidence
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

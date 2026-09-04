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

const TESSERACT_ENGINE_NAME = 'tesseract' as const

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
    setParameters: (params: Record<string, string>) => Promise<void>
    terminate: () => Promise<void>
  }>
}

let cachedWorker: Awaited<ReturnType<TesseractLike['createWorker']>> | null = null
let cachedLang: string | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Worker creation attempts. Language-data download (CDN) and WASM init can
 * fail transiently (engine-unavailable errors appearing sometimes), so a
 * failed creation is retried with backoff instead of surfacing immediately.
 */
const WORKER_CREATE_MAX_ATTEMPTS = 3
const WORKER_CREATE_RETRY_DELAYS_MS = [400, 1200]

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(done, ms)
    function done() {
      timer = null
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }
    function onAbort() {
      if (timer) clearTimeout(timer)
      timer = null
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true })
      // Aborted between the pre-check and listener registration.
      if (signal.aborted) onAbort()
    }
  })
}

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
  const workerToDispose = cachedWorker
  // Ownership check: only clear global if still same instance
  if (workerToDispose) {
    if (cachedWorker === workerToDispose) {
      cachedWorker = null
      cachedLang = null
    }
    try {
      await workerToDispose.terminate()
    } catch (e) {
      Logger.warn('[OCR:tesseract] worker terminate failed', e)
    }
  }
}

/**
 * Forcefully terminate the active worker — used by cancel/timeout to truly stop WASM computation
 * and free the queue slot (P0-3).
 */
export async function forceTerminateWorker(): Promise<void> {
  await disposeWorker()
}

/**
 * Directory holding the bundled tesseract core scripts
 * (`src/public/tesseract-core`, copied next to index.html at build time).
 * Served same-origin in dev and loaded via file:// in production, so the
 * worker's importScripts(core) satisfies script-src 'self' without any CDN
 * exception. Only the directory is passed: the worker appends the
 * SIMD-appropriate filename itself. Our createWorker calls always use
 * OEM_LSTM_ONLY, so the three *-lstm variants cover every branch.
 */
function getLocalCorePath(): string {
  return new URL('tesseract-core', document.baseURI).href
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
    corePath: getLocalCorePath(),
    gzip: true,
    logger: () => {},
    errorHandler: (e: unknown) => Logger.warn('[OCR:tesseract] worker error', e)
  } as unknown as Record<string, unknown>
  let lastError: unknown = null
  for (let attempt = 1; attempt <= WORKER_CREATE_MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      worker = await mod.createWorker(lang, 1, tesseractOpts)
      cachedWorker = worker as never
      cachedLang = lang
      scheduleIdleDispose()
      if (attempt > 1) {
        Logger.info(`[OCR:tesseract] worker creation succeeded on attempt ${attempt}`)
      }
      return worker as never
    } catch (err) {
      lastError = err
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (attempt < WORKER_CREATE_MAX_ATTEMPTS) {
        Logger.warn(
          `[OCR:tesseract] worker creation attempt ${attempt}/${WORKER_CREATE_MAX_ATTEMPTS} failed, retrying`,
          err
        )
        await abortableSleep(WORKER_CREATE_RETRY_DELAYS_MS[attempt - 1] ?? 1000, signal)
      }
    }
  }

  Logger.error(
    '[OCR:tesseract] local worker creation failed after retries — no CDN fallback',
    lastError
  )
  throw new OcrError('TESSERACT_NOT_AVAILABLE')
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

      // Page segmentation must match the input shape. Region jobs receive
      // small user-selected snippets, not full pages: PSM AUTO (3) frequently
      // finds no text blocks there and returns empty text. PSM SINGLE_BLOCK
      // (6) treats the crop as one uniform text block. The worker instance is
      // shared/cached across page and region jobs, so the mode is set
      // explicitly before every recognition. A tuning failure must never
      // break recognition — fall back to whatever mode is active.
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: job.kind === 'region' ? '6' : '3'
        })
      } catch (e) {
        Logger.warn('[OCR:tesseract] setParameters failed, continuing with defaults', e)
      }

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
        // Region jobs have no fallback path (hybrid never falls back to
        // full-page native text for regions), so a low-confidence reading is
        // kept: recognized text with a confidence value is strictly more
        // useful than a "no text" error. Page jobs keep the previous
        // throw-to-hybrid behavior.
        if (job.kind === 'region') {
          Logger.warn(
            `[OCR:tesseract] low-confidence region result kept (confidence ${confidence})`
          )
        } else if (job.config.sensitivity === 'high') {
          // Low confidence — treat as no-text to allow retry or fallback handling
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

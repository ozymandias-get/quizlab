import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useRef } from 'react'

import { createDocumentFingerprint, createOcrCacheKey } from '../lib/cacheKey'
import { ocrCache } from '../lib/ocrCache'
import { globalOcrQueue } from '../lib/ocrQueue'
import { renderPageToImageFallback } from '../lib/renderPageToImage'
import { createHybridProvider, HYBRID_ENGINE_NAME } from '../providers/hybridProvider'
import { useOcrStore } from '../store/useOcrStore'
import type { OcrConfig, OcrPageResult } from '../types'

let hybridProvider: ReturnType<typeof createHybridProvider> | null = null
let providerInitPromise: Promise<void> | null = null
let providerConfigKey: string | null = null

function getHybridProvider(
  config: OcrConfig,
  signal?: AbortSignal
): Promise<ReturnType<typeof createHybridProvider>> {
  const key = `${config.language}:${config.quality}:${config.forceOcr ? '1' : '0'}`
  if (hybridProvider && providerConfigKey === key) return Promise.resolve(hybridProvider)
  if (providerInitPromise && providerConfigKey === key)
    return providerInitPromise.then(() => hybridProvider!)

  if (!hybridProvider) hybridProvider = createHybridProvider()
  providerConfigKey = key
  providerInitPromise = hybridProvider
    .initialize(config, signal)
    .then(() => {
      providerInitPromise = null
    })
    .catch((e) => {
      providerInitPromise = null
      throw e
    })
  return providerInitPromise.then(() => hybridProvider!)
}

export function useOcrActions() {
  const { showError } = useToastActions()
  const abortRef = useRef<AbortController | null>(null)
  const queueAbortRef = useRef<(() => void) | null>(null)

  const cancel = useCallback(() => {
    queueAbortRef.current?.()
    queueAbortRef.current = null
    abortRef.current?.abort(new DOMException('Cancelled', 'AbortError'))
    abortRef.current = null
    const { requestToken } = useOcrStore.getState()
    useOcrStore.setState({ status: 'cancelled', requestToken: requestToken + 1 })
    Logger.info('[OCR] cancelled')
  }, [])

  const processPage = useCallback(
    async (params: {
      pageNumber: number
      pdfFile: {
        path?: string | null
        name?: string | null
        size?: number | null
        streamUrl?: string | null
      }
      pdfUrl?: string | null
      configOverride?: Partial<OcrConfig>
    }) => {
      const { pageNumber, pdfFile, pdfUrl, configOverride } = params
      const store = useOcrStore.getState()
      const config: OcrConfig = { ...store.config, ...configOverride }
      const fingerprint = createDocumentFingerprint(pdfFile)
      const documentId = fingerprint
      const cacheKey = createOcrCacheKey({
        fingerprint,
        pageNumber,
        engine: HYBRID_ENGINE_NAME,
        config
      })

      // Cache hit — instant
      const cached = ocrCache.get(cacheKey)
      if (cached) {
        Logger.info(`[OCR] cache hit page ${pageNumber} (${fingerprint})`)
        useOcrStore.setState({
          result: cached,
          status: 'success',
          currentPage: pageNumber,
          currentDocumentId: documentId,
          isPanelOpen: true,
          error: null
        })
        return cached
      }

      // Cancel previous job if any
      queueAbortRef.current?.()
      abortRef.current?.abort(new DOMException('Superseded', 'AbortError'))

      const token = store.bumpToken()
      const abortController = new AbortController()
      abortRef.current = abortController

      useOcrStore.setState({
        status: 'rendering-page',
        currentPage: pageNumber,
        currentDocumentId: documentId,
        error: null,
        isPanelOpen: true
      })

      Logger.info(
        `[OCR] job start page ${pageNumber} fp=${fingerprint.slice(0, 24)}... force=${config.forceOcr}`
      )

      const jobPromise = new Promise<OcrPageResult | null>((resolve, reject) => {
        const { promise, abort } = globalOcrQueue.enqueue(async (signal) => {
          // Merge external abort with queue signal
          const combined = new AbortController()
          const onAbort = () => combined.abort(signal.reason ?? abortController.signal.reason)
          signal.addEventListener('abort', onAbort, { once: true })
          abortController.signal.addEventListener('abort', onAbort, { once: true })

          let blobUrl: string | null = null
          try {
            // Check token still current before heavy work
            if (useOcrStore.getState().requestToken !== token) {
              throw new DOMException('Stale', 'AbortError')
            }

            // Step 1: Try native path first without image if not forceOcr
            // Native provider only needs DOM, no image.
            // We still need to handle rendering for OCR fallback.

            let imageForOcr: Blob | string | null = null

            // If we will need OCR (either force or native miss), prepare image
            // For performance, we don't pre-render if native succeeds; we lazy-render.
            // To avoid double logic, we attempt native inside provider which will
            // throw NO_NATIVE_TEXT if needed — then we render and retry via OCR.

            // Set initializing state
            if (useOcrStore.getState().requestToken !== token)
              throw new DOMException('Stale', 'AbortError')
            useOcrStore.setState({ status: 'initializing-engine' })

            const provider = await getHybridProvider(config, combined.signal)
            if (combined.signal.aborted) throw new DOMException('Aborted', 'AbortError')
            if (useOcrStore.getState().requestToken !== token)
              throw new DOMException('Stale', 'AbortError')

            useOcrStore.setState({ status: 'processing' })

            // Hybrid provider internally tries native → OCR.
            // For OCR branch it needs imageData — we supply lazily via closure:
            // Instead, we pre-render image now (cheap if native succeeds we waste it,
            // but avoids complex branching inside provider). The waste is small (16Mpx PNG).
            // Optimize: only render if forceOcr or after native miss? Simpler: render now.

            // Only render if pdfUrl available or canvas available
            // If we are in forceOcr=false path, provider will first try native which ignores image,
            // so we could skip render until fallback. To honor spec's "render scale 2.0" only when needed,
            // we implement two-phase: try native without image, on miss render.

            // Phase 1: try native-only via provider with dummy image (provider ignores it for native path)
            // But Hybrid provider's native path doesn't need image; it will succeed without it.
            // So we call with dummy empty blob — if it succeeds we never rendered.
            let result: OcrPageResult | null = null
            let needsOcrRender = false

            if (!config.forceOcr) {
              try {
                result = await provider.processPage(
                  {
                    id: `ocr-${fingerprint}-${pageNumber}`,
                    pageNumber,
                    documentId,
                    documentFingerprint: fingerprint,
                    config,
                    signal: combined.signal
                  },
                  '' as unknown as Blob
                )
              } catch (e) {
                const msg = (e as Error).message
                if (msg === 'NO_NATIVE_TEXT' || msg.includes('NO_NATIVE')) {
                  needsOcrRender = true
                } else if ((e as DOMException).name === 'AbortError') {
                  throw e
                } else {
                  // Other error → treat as OCR needed fallback?
                  Logger.warn('[OCR] native phase error, falling back to render', e)
                  needsOcrRender = true
                }
              }
            } else {
              needsOcrRender = true
            }

            if (needsOcrRender && !result) {
              if (combined.signal.aborted) throw new DOMException('Aborted', 'AbortError')
              useOcrStore.setState({ status: 'rendering-page' })
              const rendered = await renderPageToImageFallback(
                pdfUrl || pdfFile.streamUrl || '',
                pageNumber,
                {},
                combined.signal
              )
              if (!rendered) {
                throw new Error('PAGE_RENDER_FAILED')
              }
              blobUrl = rendered.blobUrl
              imageForOcr = rendered.blob
              if (combined.signal.aborted) {
                if (blobUrl) {
                  try {
                    URL.revokeObjectURL(blobUrl)
                  } catch {}
                }
                throw new DOMException('Aborted', 'AbortError')
              }
              useOcrStore.setState({ status: 'processing' })
              result = await provider.processPage(
                {
                  id: `ocr-${fingerprint}-${pageNumber}`,
                  pageNumber,
                  documentId,
                  documentFingerprint: fingerprint,
                  config,
                  signal: combined.signal
                },
                imageForOcr
              )
              // Clean up blob URL after processing
              if (blobUrl) {
                try {
                  URL.revokeObjectURL(blobUrl)
                } catch {}
                blobUrl = null
              }
            }

            if (!result) throw new Error('OCR_FAILED')

            // Stale check before committing
            if (useOcrStore.getState().requestToken !== token) {
              Logger.info(`[OCR] stale result discarded page ${pageNumber} (newer request exists)`)
              // Clean blob URL if any
              if (blobUrl)
                try {
                  URL.revokeObjectURL(blobUrl)
                } catch {}
              throw new DOMException('Stale', 'AbortError')
            }

            if (combined.signal.aborted) {
              if (blobUrl)
                try {
                  URL.revokeObjectURL(blobUrl)
                } catch {}
              throw new DOMException('Aborted', 'AbortError')
            }

            // Cache
            try {
              ocrCache.set(cacheKey, result)
            } catch (e) {
              Logger.warn('[OCR] cache set failed', e)
            }

            if (useOcrStore.getState().requestToken !== token)
              throw new DOMException('Stale', 'AbortError')

            useOcrStore.setState({
              result,
              status: 'success',
              error: null,
              currentPage: pageNumber,
              currentDocumentId: documentId
            })
            Logger.info(
              `[OCR] completed page ${pageNumber} engine=${result.engine} len=${result.markdown.length}`
            )
            resolve(result)
          } catch (err) {
            const isAbort =
              (err as DOMException).name === 'AbortError' ||
              (err as Error).message === 'Stale' ||
              (err as Error).message === 'Aborted'
            const isStale = (err as Error).message === 'Stale'
            if (isStale || (isAbort && useOcrStore.getState().requestToken !== token)) {
              // Silently ignore stale
              Logger.debug('[OCR] stale/aborted job ignored', err)
              resolve(null)
              return
            }
            if (isAbort) {
              useOcrStore.setState({ status: 'cancelled' })
              Logger.info('[OCR] job aborted', err)
              resolve(null)
              return
            }

            const message = err instanceof Error ? err.message : String(err)
            const userMessage = mapErrorToUserMessage(message)
            useOcrStore.setState({ status: 'error', error: userMessage })
            Logger.error('[OCR] job failed', err)
            // Do not show toast for PAGE_RENDER_FAILED when panel already explains?
            showError(userMessage)
            reject(err)
          } finally {
            signal.removeEventListener('abort', onAbort)
            abortController.signal.removeEventListener('abort', onAbort)
            if (blobUrl) {
              try {
                URL.revokeObjectURL(blobUrl)
              } catch {}
            }
          }
        }, abortController.signal)

        queueAbortRef.current = abort

        promise.then(() => resolve(null)).catch(reject)
      })

      try {
        const res = await jobPromise
        queueAbortRef.current = null
        abortRef.current = null
        return res
      } catch {
        queueAbortRef.current = null
        abortRef.current = null
        // Error already set in store
        return null
      }
    },
    [showError]
  )

  const retry = useCallback(async () => {
    const s = useOcrStore.getState()
    if (s.currentPage == null) return
    // Force OCR on retry to give better chance on scanned pages
    // But respect original config unless user explicitly wants native again — we'll just re-run with same config
    // Better to offer both; here we just re-run.
    // Need pdfFile context — caller should supply; retry without context cannot render.
    // So this retry is placeholder; actual retry is via OcrResultPanel that knows pdfFile.
    Logger.info('[OCR] retry requested')
  }, [])

  return { processPage, cancel, retry }
}

function mapErrorToUserMessage(code: string): string {
  switch (code) {
    case 'PAGE_RENDER_FAILED':
      return 'ocr_error_render_failed'
    case 'TESSERACT_NOT_AVAILABLE':
      return 'ocr_error_engine_not_available'
    case 'NO_TEXT_RECOGNIZED':
      return 'ocr_error_no_text'
    case 'OCR_FAILED':
      return 'ocr_error_generic'
    case 'NO_NATIVE_TEXT':
      return 'ocr_error_no_text'
    default:
      return 'ocr_error_generic'
  }
}

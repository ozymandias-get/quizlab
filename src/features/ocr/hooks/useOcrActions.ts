import { getActiveViewerSnapshot } from '@features/pdf/lib/activeViewerSnapshot'

import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'

import { useCallback } from 'react'

import { createDocumentFingerprint, createOcrCacheKey } from '../lib/cacheKey'
import { ocrCache } from '../lib/ocrCache'
import { cancelActiveJob, clearActiveJobIf, getActiveJob, setActiveJob } from '../lib/ocrJobManager'
import { globalOcrQueue } from '../lib/ocrQueue'
import { renderPageToImageFallback } from '../lib/renderPageToImage'
import { createHybridProvider, HYBRID_ENGINE_NAME } from '../providers/hybridProvider'
import { useOcrStore } from '../store/useOcrStore'
import type { OcrConfig, OcrPageResult } from '../types'
import { OcrError } from '../types'

// Singleton provider instance — shared across all hook callers
let hybridProvider: ReturnType<typeof createHybridProvider> | null = null
let providerInitPromise: Promise<void> | null = null
let providerConfigKey: string | null = null

function getHybridProvider(
  config: OcrConfig,
  signal?: AbortSignal
): Promise<ReturnType<typeof createHybridProvider>> {
  const key = `${config.language}:${config.quality}:${config.sensitivity}:${config.forceOcr ? '1' : '0'}`
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

/** Build document fingerprint — authoritative source is pdfFile fields only for stability */
function buildFingerprint(pdfFile: {
  path?: string | null
  name?: string | null
  size?: number | null
  streamUrl?: string | null
}): string {
  return createDocumentFingerprint(pdfFile)
}

export function useOcrActions() {
  const { showError } = useToastActions()

  const cancel = useCallback(() => {
    void cancelActiveJob()
    Logger.info('[OCR] cancelled via useOcrActions')
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
      const fingerprint = buildFingerprint(pdfFile)
      const documentId = fingerprint
      const cacheKey = createOcrCacheKey({
        fingerprint,
        pageNumber,
        engine: HYBRID_ENGINE_NAME,
        config
      })

      const cached = ocrCache.get(cacheKey)
      if (cached) {
        Logger.info(`[OCR] cache hit page ${pageNumber} (${fingerprint})`)
        // Abort any in-flight globally
        const active = getActiveJob()
        if (active) void cancelActiveJob()
        const t = useOcrStore.getState().bumpToken()
        void t
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

      // Cancel previous job globally before starting new one
      const prev = getActiveJob()
      if (prev) await cancelActiveJob()

      const token = store.bumpToken()
      const abortController = new AbortController()

      // Clear stale result when new job starts (P0-4: avoid showing old doc's result)
      useOcrStore.setState({
        status: 'rendering-page',
        currentPage: pageNumber,
        currentDocumentId: documentId,
        error: null,
        result: null,
        isPanelOpen: true
      })

      Logger.info(
        `[OCR] job start page ${pageNumber} fp=${fingerprint.slice(0, 24)}... force=${config.forceOcr} q=${config.quality}`
      )

      const jobId = `ocr-${fingerprint}-${pageNumber}-${Date.now()}`

      const jobPromise = new Promise<OcrPageResult | null>((resolve, reject) => {
        const { promise, abort } = globalOcrQueue.enqueue(async (signal) => {
          setActiveJob({
            id: jobId,
            documentId,
            pageNumber,
            abortController,
            queueAbort: abort
          })
          const combined = new AbortController()
          const onAbort = () => combined.abort(signal.reason ?? abortController.signal.reason)
          signal.addEventListener('abort', onAbort, { once: true })
          abortController.signal.addEventListener('abort', onAbort, { once: true })

          let blobUrl: string | null = null
          try {
            if (useOcrStore.getState().requestToken !== token) {
              throw new DOMException('Stale', 'AbortError')
            }

            let imageForOcr: Blob | string | null = null

            if (useOcrStore.getState().requestToken !== token)
              throw new DOMException('Stale', 'AbortError')
            useOcrStore.setState({ status: 'initializing-engine' })

            const provider = await getHybridProvider(config, combined.signal)
            if (combined.signal.aborted) throw new DOMException('Aborted', 'AbortError')
            if (useOcrStore.getState().requestToken !== token)
              throw new DOMException('Stale', 'AbortError')

            useOcrStore.setState({ status: 'processing' })

            let result: OcrPageResult | null = null
            let needsOcrRender = false

            if (!config.forceOcr) {
              try {
                result = await provider.processPage(
                  {
                    id: jobId,
                    pageNumber,
                    documentId,
                    documentFingerprint: fingerprint,
                    config,
                    signal: combined.signal,
                    kind: 'page'
                  },
                  '' as unknown as Blob
                )
              } catch (e) {
                const code =
                  e instanceof OcrError ? e.code : e instanceof Error ? e.message : String(e ?? '')
                if (
                  code === 'NO_NATIVE_TEXT' ||
                  (typeof code === 'string' && code.includes('NO_NATIVE'))
                ) {
                  needsOcrRender = true
                } else if ((e as DOMException).name === 'AbortError') {
                  throw e
                } else if (e instanceof OcrError) {
                  throw e
                } else {
                  const msg = e instanceof Error ? e.message : String(e ?? '')
                  const isImageReadError =
                    msg.includes('pixRead') ||
                    msg.includes('Unknown format') ||
                    msg.includes('cannot be read') ||
                    msg.includes('attempting to read image') ||
                    msg.includes('/input')
                  if (isImageReadError) {
                    Logger.debug('[OCR] native phase awaiting render', e)
                  } else {
                    Logger.warn('[OCR] native phase error, falling back to render', e)
                  }
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
                { quality: config.quality },
                combined.signal
              )
              if (!rendered) {
                throw new OcrError('PAGE_RENDER_FAILED')
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
                  id: jobId,
                  pageNumber,
                  documentId,
                  documentFingerprint: fingerprint,
                  config,
                  signal: combined.signal,
                  kind: 'page'
                },
                imageForOcr
              )
              if (blobUrl) {
                try {
                  URL.revokeObjectURL(blobUrl)
                } catch {}
                blobUrl = null
              }
            }

            if (!result) throw new OcrError('OCR_FAILED')

            if (useOcrStore.getState().requestToken !== token) {
              Logger.info(`[OCR] stale result discarded page ${pageNumber}`)
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

            // Validate staleness before caching — token and document must still match
            if (useOcrStore.getState().requestToken !== token)
              throw new DOMException('Stale', 'AbortError')
            {
              const cur = useOcrStore.getState()
              if (cur.currentDocumentId !== documentId || cur.currentPage !== pageNumber)
                throw new DOMException('Stale', 'AbortError')
            }

            try {
              ocrCache.set(cacheKey, result)
            } catch (e) {
              Logger.warn('[OCR] cache set failed', e)
            }

            if (useOcrStore.getState().requestToken !== token)
              throw new DOMException('Stale', 'AbortError')

            // Final documentId + pageNumber invariant check (P0-4)
            const finalState = useOcrStore.getState()
            if (finalState.requestToken === token) {
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
            }
            resolve(result)
          } catch (err) {
            const isAbort =
              (err as DOMException).name === 'AbortError' ||
              (err as Error).message === 'Stale' ||
              (err as Error).message === 'Aborted'
            const isStale = (err as Error).message === 'Stale'
            if (isStale || (isAbort && useOcrStore.getState().requestToken !== token)) {
              Logger.debug('[OCR] stale/aborted job ignored', err)
              resolve(null)
              return
            }
            if (err instanceof OcrError) {
              const userMessage = mapErrorToUserMessage(err.code)
              // Distinguish outcomes: noText vs engineUnavailable should not be cached as success
              if (err.code === 'NO_TEXT_RECOGNIZED' || err.code === 'TESSERACT_NOT_AVAILABLE') {
                // Don't cache these — set appropriate error state instead of success with fake markdown
                useOcrStore.setState({ status: 'error', error: userMessage })
                Logger.warn('[OCR] job no-text/engine unavailable', err)
                showError(userMessage)
                reject(err)
                return
              }
              if (err.code === 'TIMEOUT') {
                useOcrStore.setState({ status: 'error', error: userMessage })
                showError(userMessage)
                reject(err)
                return
              }
            }
            if (isAbort) {
              useOcrStore.setState({ status: 'cancelled' })
              Logger.info('[OCR] job aborted', err)
              resolve(null)
              return
            }

            const code =
              err instanceof OcrError ? err.code : err instanceof Error ? err.message : String(err)
            const userMessage = mapErrorToUserMessage(code)
            useOcrStore.setState({ status: 'error', error: userMessage })
            Logger.error('[OCR] job failed', err)
            showError(userMessage)
            reject(err)
          } finally {
            signal.removeEventListener('abort', onAbort)
            abortController.signal.removeEventListener('abort', onAbort)
            clearActiveJobIf(jobId)
            if (blobUrl) {
              try {
                URL.revokeObjectURL(blobUrl)
              } catch {}
            }
          }
        }, abortController.signal)

        promise.then(() => resolve(null)).catch(reject)
      })

      try {
        const res = await jobPromise
        clearActiveJobIf(jobId)
        return res
      } catch {
        clearActiveJobIf(jobId)
        return null
      }
    },
    [showError]
  )

  const processArea = useCallback(
    async (params: {
      dataUrl: string
      pageNumber: number
      pdfFile: {
        path?: string | null
        name?: string | null
        size?: number | null
        streamUrl?: string | null
      }
    }) => {
      const { dataUrl, pageNumber, pdfFile: _pdfFile } = params
      void _pdfFile
      const store = useOcrStore.getState()

      // Capture-time validation: immutable snapshot vs CURRENT active viewer
      // Snapshot was stored at selection start as pendingFingerprint/pendingPage/pendingToken
      const snapshotFingerprint = store.pendingFingerprint
      const snapshotPage = store.pendingPage
      const snapshotToken = store.pendingToken
      const snapshotGen = store.selectionGeneration
      const currentViewer = getActiveViewerSnapshot()
      const currentToken = store.requestToken
      const currentGen = store.selectionGeneration

      // If selection was cleared or superseded, discard
      if (snapshotFingerprint == null || snapshotPage == null || snapshotToken == null) {
        Logger.warn('[OCR] area capture without valid snapshot — discarding')
        return null
      }
      // Document changed since selection start
      if (currentViewer.fingerprint != null && snapshotFingerprint !== currentViewer.fingerprint) {
        Logger.warn('[OCR] area capture document stale — discarding', {
          snapshot: snapshotFingerprint.slice(0, 16),
          current: currentViewer.fingerprint.slice(0, 16)
        })
        useOcrStore.getState().cancelAreaSelection()
        return null
      }
      // Page changed since selection start
      if (snapshotPage !== pageNumber || currentViewer.page !== snapshotPage) {
        Logger.warn('[OCR] area capture page stale — discarding', {
          snapshotPage,
          paramPage: pageNumber,
          currentPage: currentViewer.page
        })
        useOcrStore.getState().cancelAreaSelection()
        return null
      }
      // Token changed (new OCR / document switch bumped token)
      if (snapshotToken !== currentToken) {
        Logger.warn('[OCR] area capture token stale — discarding', {
          snapshotToken,
          currentToken
        })
        useOcrStore.getState().cancelAreaSelection()
        return null
      }
      // Generation changed (selection cancelled/restarted)
      if (snapshotGen !== currentGen) {
        Logger.warn('[OCR] area capture generation stale — discarding')
        return null
      }

      // Passed snapshot check — use snapshot's fingerprint/documentId rather than rebuilding
      const fingerprint = snapshotFingerprint
      const documentId = store.pendingDocumentId ?? fingerprint

      const config: OcrConfig = { ...store.config, forceOcr: true }

      const prev = getActiveJob()
      if (prev) await cancelActiveJob()

      const token = store.bumpToken()
      const abortController = new AbortController()
      const jobId = `ocr-area-${fingerprint}-${pageNumber}-${Date.now()}`

      useOcrStore.setState({
        status: 'processing',
        currentPage: pageNumber,
        currentDocumentId: documentId,
        error: null,
        result: null,
        isPanelOpen: true
      })

      Logger.info(`[OCR] area job start page ${pageNumber} fp=${fingerprint.slice(0, 24)}...`)

      const jobPromise = new Promise<OcrPageResult | null>((resolve, reject) => {
        const { promise, abort } = globalOcrQueue.enqueue(async (signal) => {
          Logger.info(`[OCR] area queue job started id=${jobId}`)
          setActiveJob({ id: jobId, documentId, pageNumber, abortController, queueAbort: abort })
          const combined = new AbortController()
          const onAbort = () => combined.abort(signal.reason ?? abortController.signal.reason)
          signal.addEventListener('abort', onAbort, { once: true })
          abortController.signal.addEventListener('abort', onAbort, { once: true })

          try {
            Logger.info(
              `[OCR] area queue check token ${useOcrStore.getState().requestToken} vs ${token}`
            )
            if (useOcrStore.getState().requestToken !== token)
              throw new DOMException('Stale', 'AbortError')
            useOcrStore.setState({ status: 'initializing-engine' })
            const provider = await getHybridProvider(config, combined.signal)
            if (combined.signal.aborted) throw new DOMException('Aborted', 'AbortError')
            if (useOcrStore.getState().requestToken !== token)
              throw new DOMException('Stale', 'AbortError')
            // Snapshot documentId at processing time — if changed since scheduling, abort
            // P2 fix: document mismatch alone is stale, don't gate it behind token check
            const curDoc = useOcrStore.getState().currentDocumentId
            if (curDoc !== documentId) {
              throw new DOMException('Stale', 'AbortError')
            }
            useOcrStore.setState({ status: 'processing' })

            const result = await provider.processPage(
              {
                id: jobId,
                pageNumber,
                documentId,
                documentFingerprint: fingerprint,
                config,
                signal: combined.signal,
                kind: 'region'
              },
              dataUrl
            )

            if (useOcrStore.getState().requestToken !== token)
              throw new DOMException('Stale', 'AbortError')
            if (combined.signal.aborted) throw new DOMException('Aborted', 'AbortError')

            const areaResult: OcrPageResult = {
              ...result,
              markdown: result.markdown,
              blocks: result.blocks
            }

            // Final staleness check includes documentId (P0-4)
            const finalState = useOcrStore.getState()
            if (finalState.requestToken !== token || finalState.currentDocumentId !== documentId) {
              throw new DOMException('Stale', 'AbortError')
            }

            useOcrStore.setState({
              result: areaResult,
              status: 'success',
              error: null,
              currentPage: pageNumber,
              currentDocumentId: documentId
            })
            Logger.info(
              `[OCR] area completed page ${pageNumber} engine=${result.engine} len=${result.markdown.length}`
            )
            resolve(areaResult)
          } catch (err) {
            const isAbort =
              (err as DOMException).name === 'AbortError' ||
              (err as Error).message === 'Stale' ||
              (err as Error).message === 'Aborted'
            const isStale = (err as Error).message === 'Stale'
            if (isStale || (isAbort && useOcrStore.getState().requestToken !== token)) {
              Logger.debug('[OCR] area stale/aborted ignored', err)
              resolve(null)
              return
            }
            if (err instanceof OcrError) {
              const userMessage = mapErrorToUserMessage(err.code)
              useOcrStore.setState({ status: 'error', error: userMessage })
              Logger.warn('[OCR] area job typed error', err)
              if (err.code !== 'NO_TEXT_RECOGNIZED') showError(userMessage)
              reject(err)
              return
            }
            if (isAbort) {
              useOcrStore.setState({ status: 'cancelled' })
              Logger.info('[OCR] area job aborted', err)
              resolve(null)
              return
            }
            const code = err instanceof Error ? err.message : String(err)
            const userMessage = mapErrorToUserMessage(code)
            useOcrStore.setState({ status: 'error', error: userMessage })
            Logger.error('[OCR] area job failed', err)
            showError(userMessage)
            reject(err)
          } finally {
            signal.removeEventListener('abort', onAbort)
            abortController.signal.removeEventListener('abort', onAbort)
            clearActiveJobIf(jobId)
          }
        }, abortController.signal)

        promise.then(() => resolve(null)).catch(reject)
      })

      try {
        const res = await jobPromise
        clearActiveJobIf(jobId)
        return res
      } catch {
        clearActiveJobIf(jobId)
        return null
      }
    },
    [showError]
  )

  const retry = useCallback(
    async (params?: {
      pageNumber?: number
      pdfFile?: {
        path?: string | null
        name?: string | null
        size?: number | null
        streamUrl?: string | null
      }
      pdfUrl?: string | null
    }) => {
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
        const fp = buildFingerprint(file)
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

function mapErrorToUserMessage(code: string): string {
  if (code.includes('PAGE_RENDER_FAILED')) return 'ocr_error_render_failed'
  if (code.includes('TESSERACT_NOT_AVAILABLE')) return 'ocr_error_engine_not_available'
  if (code.includes('NO_TEXT_RECOGNIZED') || code.includes('NO_NATIVE_TEXT'))
    return 'ocr_error_no_text'
  if (code.includes('TIMEOUT')) return 'ocr_error_timeout'
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
    case 'TIMEOUT':
      return 'ocr_error_timeout'
    default:
      return 'ocr_error_generic'
  }
}

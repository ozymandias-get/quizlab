import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'

import { useCallback } from 'react'

import { createDocumentFingerprint, createOcrCacheKey } from '../lib/cacheKey'
import { getHybridProvider } from '../lib/hybridProviderSingleton'
import { ocrCache } from '../lib/ocrCache'
import { mapErrorToUserMessage } from '../lib/ocrErrorMessages'
import { cancelActiveJob, clearActiveJobIf, getActiveJob, setActiveJob } from '../lib/ocrJobManager'
import { globalOcrQueue } from '../lib/ocrQueue'
import { renderPageToImageFallback } from '../lib/renderPageToImage'
import { HYBRID_ENGINE_NAME } from '../providers/hybridProvider'
import { useOcrStore } from '../store/useOcrStore'
import type { OcrConfig, OcrPageResult, OcrPdfFile } from '../types'
import { OcrError } from '../types'

/**
 * Document page OCR flow: cache lookup → native-text fast path →
 * page-render fallback → cache write, with token-based staleness guards.
 *
 * Split from `useOcrActions`: page scanning changes when caching/render
 * strategy changes, while area scanning changes when the selection snapshot
 * protocol changes. `useOcrActions` re-composes this hook unchanged.
 */
export function useOcrPageScan() {
  const { showError } = useToastActions()

  const processPage = useCallback(
    async (params: {
      pageNumber: number
      pdfFile: OcrPdfFile
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

      const cached = ocrCache.get(cacheKey)
      if (cached) {
        Logger.info(`[OCR] cache hit page ${pageNumber} (${fingerprint})`)
        // Abort any in-flight globally
        const active = getActiveJob()
        if (active) void cancelActiveJob()
        useOcrStore.getState().bumpToken()
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
                if (code.includes('NO_NATIVE')) {
                  needsOcrRender = true
                } else if ((e as DOMException).name === 'AbortError') {
                  throw e
                } else if (e instanceof OcrError) {
                  throw e
                }
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

  return { processPage }
}

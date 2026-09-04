import { getActiveViewerSnapshot } from '@features/pdf/lib/activeViewerSnapshot'

import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'

import { useCallback } from 'react'

import { getHybridProvider } from '../lib/hybridProviderSingleton'
import { grayscaleStretch } from '../lib/imagePreprocess'
import { mapErrorToUserMessage } from '../lib/ocrErrorMessages'
import { cancelActiveJob, clearActiveJobIf, getActiveJob, setActiveJob } from '../lib/ocrJobManager'
import { globalOcrQueue } from '../lib/ocrQueue'
import { useOcrStore } from '../store/useOcrStore'
import type { OcrConfig, OcrPageResult, OcrPdfFile } from '../types'
import { OcrError } from '../types'

/**
 * Minimum working resolution for region recognition. User-selected crops are
 * often only a few hundred pixels wide — below what the LSTM engine segments
 * reliably — so small captures are enlarged before recognition.
 */
const AREA_MIN_DIMENSION = 1000
/** Upper bound for enlargement: avoids runaway memory/time on huge selections. */
const AREA_MAX_DIMENSION = 3000
/** White border around the crop: tight selections clip edge glyphs. */
const AREA_PAD = 12

/**
 * Decodes a base64 data URL to a Blob without fetch: fetch(data:) is blocked
 * by connect-src (no data: source), while local decoding never leaves the page.
 * Returns null for non-base64 or malformed URLs.
 */
function dataUrlToBlob(dataUrl: string): Blob | null {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return null
  const header = dataUrl.slice(0, comma)
  if (!/;base64$/i.test(header)) return null
  const mime = header.slice(5, -7) || 'image/png'
  const binary = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

/**
 * Returns an OCR-ready image for the captured region: enlarges small crops
 * for reliable recognition. Never throws — any decode/environment failure
 * falls back to the original capture so a tuning step can never break a
 * working flow.
 */
async function prepareAreaImage(dataUrl: string): Promise<string> {
  try {
    if (!dataUrl.startsWith('data:image/')) return dataUrl
    if (typeof createImageBitmap !== 'function') return dataUrl
    const blob = dataUrlToBlob(dataUrl)
    if (!blob) return dataUrl
    const bitmap = await createImageBitmap(blob)
    try {
      const { width, height } = bitmap
      Logger.info(
        `[OCR] area capture image ${width}x${height}, ${(dataUrl.length / 1024).toFixed(1)} KB`
      )
      const maxDim = Math.max(width, height)
      let targetW = width
      let targetH = height
      if (maxDim > 0 && maxDim < AREA_MIN_DIMENSION) {
        const scale = Math.min(AREA_MIN_DIMENSION / maxDim, AREA_MAX_DIMENSION / maxDim)
        targetW = Math.max(1, Math.round(width * scale))
        targetH = Math.max(1, Math.round(height * scale))
        Logger.info(`[OCR] area image enlarged to ${targetW}x${targetH}`)
      }
      const work = document.createElement('canvas')
      work.width = Math.max(1, targetW)
      work.height = Math.max(1, targetH)
      const ctx = work.getContext('2d')
      if (!ctx) return dataUrl
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, work.width, work.height)
      ctx.drawImage(bitmap, 0, 0, work.width, work.height)
      // Grayscale + contrast stretch (paper to white, ink to black). A
      // preprocessing failure must not fail the job — the unprocessed canvas
      // is still a valid input below.
      try {
        const img = ctx.getImageData(0, 0, work.width, work.height)
        grayscaleStretch(img.data)
        ctx.putImageData(img, 0, 0)
      } catch (e) {
        Logger.warn('[OCR] area preprocess skipped', e)
      }
      let outCanvas = work
      const padded = document.createElement('canvas')
      padded.width = work.width + AREA_PAD * 2
      padded.height = work.height + AREA_PAD * 2
      const padCtx = padded.getContext('2d')
      if (padCtx) {
        padCtx.fillStyle = '#ffffff'
        padCtx.fillRect(0, 0, padded.width, padded.height)
        padCtx.drawImage(work, AREA_PAD, AREA_PAD)
        outCanvas = padded
      }
      const out = outCanvas.toDataURL('image/png')
      if (out && out.startsWith('data:image/') && out !== 'data:,') {
        return out
      }
      return dataUrl
    } finally {
      bitmap.close()
    }
  } catch (e) {
    Logger.warn('[OCR] area image prep failed, using original capture', e)
    return dataUrl
  }
}

/**
 * Region/area capture OCR flow: immutable selection-snapshot validation
 * against the current active viewer, then forced OCR without cache.
 *
 * Split from `useOcrActions`: area scanning changes when the selection
 * snapshot protocol changes, while page scanning changes when caching/render
 * strategy changes. `useOcrActions` re-composes this hook unchanged.
 */
export function useOcrAreaScan() {
  const { showError } = useToastActions()

  const processArea = useCallback(
    async (params: { dataUrl: string; pageNumber: number; pdfFile: OcrPdfFile }) => {
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

      // Normalize capture resolution before queueing so every attempt —
      // including the first — recognizes from the same quality baseline.
      const areaImage = await prepareAreaImage(dataUrl)

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
              areaImage
            )

            if (useOcrStore.getState().requestToken !== token)
              throw new DOMException('Stale', 'AbortError')
            if (combined.signal.aborted) throw new DOMException('Aborted', 'AbortError')

            const areaResult: OcrPageResult = {
              ...result
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

  return { processArea }
}

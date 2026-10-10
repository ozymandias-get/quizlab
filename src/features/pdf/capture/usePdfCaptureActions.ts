/**
 * The two capture actions, and the ladder that keeps a screenshot request from
 * dead-ending.
 *
 * | Rung | What it does                                                              |
 * | ---- | ------------------------------------------------------------------------- |
 * | 1    | direct high-DPI render from PDF.js (scale 4.0, 20 MP)                      |
 * | 2    | the mounted page canvas as a synchronous data URL                         |
 * | 3    | the same canvas after a progressive retry ladder (~900 ms)                 |
 * | 4    | a low-resolution direct render (scale 2)                                  |
 * | 5    | the capture-failed toast                                                  |
 *
 * Every rung below the first has to stay reachable, or a busy document silently
 * loses its screenshot. The crop screenshot is a different path entirely: it never
 * touches PDF.js, because the main process crops the window.
 *
 * ## One page source
 *
 * Both actions label their result with a page number, and both read it from
 * `capturePageRef`, which the viewer writes as the current page changes. The rest
 * of this hook is renderer-agnostic on purpose: `renderPageToImageFallback`
 * borrows the mounted document and `findPageCanvas` resolves whichever canvas is
 * on screen, so this file needed no native branch and its supersession contract
 * is shared.
 *
 * ## Supersession
 *
 * Every request is stamped, and a result from a superseded one is dropped **and
 * its object URL revoked**, at each `await`. The stamp covers a document switch
 * (the URL must still match), a newer capture request, and unmount — so a render
 * that lands after the reader moved on cannot overwrite the current action state.
 */
import { useToastActions } from '@app/providers'
import { buildPdfSourceMeta } from '@app/providers/ai/pdfSource'
import type { AiDraftImageItem } from '@app/providers/ai/types'
import { Logger } from '@shared/lib/logger'

import { useCallback, useEffect, useRef } from 'react'

import { captureCanvasAsBlob } from './captureCanvasAsBlob'
import { findPageCanvas } from './findPageCanvas'

type CaptureMeta = Pick<AiDraftImageItem, 'page' | 'captureKind'> & {
  source?: AiDraftImageItem['source']
}

interface UsePdfCaptureActionsOptions {
  currentPage: number
  totalPages?: number
  pdfFile?: {
    path?: string | null
    name?: string | null
    streamUrl?: string | null
    size?: number | null
  } | null
  /**
   * The page capture should actually read.
   *
   * The viewer writes the live page here, so a capture triggered in the same tick
   * as a page change names the page the reader is now looking at rather than the
   * page the hook last rendered. `PdfViewerDocument` owns the renderer, so it is
   * the only place that can say which page is live; it writes the answer here,
   * through a ref. A ref rather than a value because this hook already
   * reads the page exactly once — at capture time, into `pageAtCaptureTime`, so
   * the AI item is labelled with the page the reader was looking at when they
   * pressed the button and not with whatever is current when the render lands.
   */
  capturePageRef?: React.RefObject<number>
  queueImageForAi: (dataUrl: string, imageMeta?: CaptureMeta) => void
  startScreenshot: (imageMeta?: CaptureMeta) => void
  pdfUrl?: string | null
}

export function usePdfCaptureActions({
  currentPage,
  totalPages,
  pdfFile,
  capturePageRef,
  queueImageForAi,
  startScreenshot,
  pdfUrl
}: UsePdfCaptureActionsOptions) {
  const { showError } = useToastActions()
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = capturePageRef?.current ?? currentPage
  const totalPagesRef = useRef(totalPages ?? 0)
  totalPagesRef.current = totalPages ?? 0
  const pdfFileRef = useRef(pdfFile ?? null)
  pdfFileRef.current = pdfFile ?? null
  const pdfUrlRef = useRef(pdfUrl)
  pdfUrlRef.current = pdfUrl
  const mountedRef = useRef(true)
  const captureRequestIdRef = useRef(0)

  const buildFullPageMeta = useCallback((pageAtCaptureTime: number): CaptureMeta => {
    const total = totalPagesRef.current >= 1 ? totalPagesRef.current : undefined
    const file = pdfFileRef.current
    return {
      page: pageAtCaptureTime,
      captureKind: 'full-page',
      source: buildPdfSourceMeta({
        file: file
          ? { path: file.path, streamUrl: file.streamUrl, name: file.name, size: file.size }
          : null,
        page: pageAtCaptureTime,
        totalPages: total,
        captureKind: 'full-page-image'
      })
    }
  }, [])

  useEffect(() => {
    return () => {
      mountedRef.current = false
      captureRequestIdRef.current += 1
    }
  }, [])

  const handleFullPageScreenshot = useCallback(async () => {
    const pageAtCaptureTime = currentPageRef.current
    const pdfUrlAtCaptureTime = pdfUrlRef.current
    const requestId = ++captureRequestIdRef.current
    const isCurrentCapture = () =>
      mountedRef.current &&
      requestId === captureRequestIdRef.current &&
      pdfUrlRef.current === pdfUrlAtCaptureTime
    Logger.info(
      `[PdfCapture] handleFullPageScreenshot triggered for page ${pageAtCaptureTime}, hasPdfUrl=${!!pdfUrlAtCaptureTime}`
    )
    try {
      // Kalite öncelikli: pdfUrl varsa doğrudan PDF.js ile ultra yüksek çözünürlüklü
      // (scale 4.0, ~288 DPI - 4K Ultra HD) render al. Bu, ekrandaki zoom seviyesinden
      // bağımsız olarak metin ve mikroskop fotoğraflarının kristal netliğinde çıkmasını sağlar.
      if (pdfUrlAtCaptureTime) {
        try {
          const { renderPageToImageFallback } = await import('@features/pdf/lib/renderPageToImage')
          const rendered = await renderPageToImageFallback(pdfUrlAtCaptureTime, pageAtCaptureTime, {
            scale: 4.0,
            maxPixels: 20_000_000
          })
          if (!isCurrentCapture()) {
            if (rendered?.blobUrl) URL.revokeObjectURL(rendered.blobUrl)
            return
          }
          if (rendered?.blob && rendered?.blobUrl) {
            Logger.info(
              `[PdfCapture] High-DPI page render ready: ${rendered.width}x${rendered.height}, size: ${(rendered.blob.size / 1024).toFixed(1)} KB`
            )
            try {
              const dataUrl: string = await new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.onerror = () => reject(new Error('read failed'))
                reader.readAsDataURL(rendered.blob)
              })
              if (!isCurrentCapture()) {
                URL.revokeObjectURL(rendered.blobUrl)
                return
              }
              if (dataUrl.startsWith('data:image/')) {
                queueImageForAi(dataUrl, buildFullPageMeta(pageAtCaptureTime))
                URL.revokeObjectURL(rendered.blobUrl)
                return
              }
            } catch (readErr) {
              Logger.warn('[PdfCapture] FileReader failed:', readErr)
            }
            if (!isCurrentCapture()) {
              URL.revokeObjectURL(rendered.blobUrl)
              return
            }
            queueImageForAi(rendered.blobUrl, buildFullPageMeta(pageAtCaptureTime))
            return
          } else {
            Logger.warn('[PdfCapture] renderPageToImageFallback returned null')
          }
        } catch (renderErr) {
          Logger.warn(
            '[PdfCapture] renderPageToImageFallback failed, falling back to canvas:',
            renderErr
          )
        }
        // Yüksek çözünürlüklü render başarısız olursa canvas yoluna düş
      }

      let targetCanvas = findPageCanvas(pageAtCaptureTime)

      if (!targetCanvas) {
        // PDF page canvas is rendered asynchronously via pdf.js. On large
        // documents or slow machines the rasterization can take >240 ms.
        // Retry with progressive delay (total ~900 ms) instead of failing
        // immediately and showing a confusing "capture failed" toast.
        const MAX_RETRIES = 10
        for (let i = 0; i < MAX_RETRIES; i++) {
          const delayMs = 30 + i * 20 // 30, 50, 70, ... 210 ms
          await new Promise((r) => setTimeout(r, delayMs))
          if (!isCurrentCapture()) return
          targetCanvas = findPageCanvas(pageAtCaptureTime)
          if (targetCanvas) break
        }
      }

      if (!targetCanvas) {
        // Last resort: try direct PDF.js render if we have a URL. This
        // covers cases where the canvas hasn't been rasterized yet (e.g.
        // fast navigation, large document, or hidden viewer).
        if (pdfUrlAtCaptureTime) {
          try {
            const { renderPageToImageFallback } =
              await import('@features/pdf/lib/renderPageToImage')
            const rendered = await renderPageToImageFallback(
              pdfUrlAtCaptureTime,
              pageAtCaptureTime,
              {
                scale: 2
              }
            )
            if (!isCurrentCapture()) {
              if (rendered?.blobUrl) URL.revokeObjectURL(rendered.blobUrl)
              return
            }
            if (rendered?.blobUrl) {
              queueImageForAi(rendered.blobUrl, buildFullPageMeta(pageAtCaptureTime))
              return
            }
          } catch {}
        }
        showError('toast_capture_failed')
        return
      }

      if (!isCurrentCapture()) return

      // Defensive: canvas may have been zeroed by GPU cleanup between
      // discovery and blob conversion (e.g. rapid navigation). Re-validate.
      if (targetCanvas.width === 0 || targetCanvas.height === 0) {
        const retry = findPageCanvas(pageAtCaptureTime)
        if (retry && retry.width > 0 && retry.height > 0) {
          targetCanvas = retry
        } else {
          showError('toast_capture_failed')
          return
        }
      }

      if (!isCurrentCapture()) return

      // Prefer a synchronous data URL for the queue: it keeps both dataUrl
      // and a lightweight blobUrl for preview, and avoids the later
      // blobUrl -> dataUrl fetch round-trip (which can fail if the blob
      // URL is revoked or fetch is blocked). Use the same area threshold
      // as captureCanvasAsBlob to pick JPEG for large canvases.
      let queued = false
      try {
        const area = targetCanvas.width * targetCanvas.height
        const isLarge = area > 12_000_000
        const mime = isLarge ? 'image/jpeg' : 'image/png'
        const quality = isLarge ? 0.95 : undefined
        const dataUrl = targetCanvas.toDataURL(mime, quality as unknown as number)
        if (dataUrl && dataUrl.startsWith('data:image/') && dataUrl !== 'data:,') {
          queueImageForAi(dataUrl, buildFullPageMeta(pageAtCaptureTime))
          queued = true
        }
      } catch {}

      if (!queued) {
        let result
        try {
          result = await captureCanvasAsBlob(targetCanvas)
        } catch {
          // Only the current request may complain. A superseded one that fails on the
          // way out would raise a failure toast next to whatever its successor queued.
          if (isCurrentCapture()) showError('toast_capture_failed')
          return
        }
        if (!isCurrentCapture()) {
          URL.revokeObjectURL(result.blobUrl)
          return
        }
        queueImageForAi(result.blobUrl, buildFullPageMeta(pageAtCaptureTime))
      }
    } catch {
      if (isCurrentCapture()) showError('toast_capture_failed')
    }
  }, [queueImageForAi, showError, buildFullPageMeta])

  const handleAreaScreenshot = useCallback(() => {
    const page = currentPageRef.current
    const total = totalPagesRef.current >= 1 ? totalPagesRef.current : undefined
    const file = pdfFileRef.current
    startScreenshot({
      page,
      captureKind: 'selection',
      source: buildPdfSourceMeta({
        file: file
          ? { path: file.path, streamUrl: file.streamUrl, name: file.name, size: file.size }
          : null,
        page,
        totalPages: total,
        captureKind: 'area-image'
      })
    })
  }, [startScreenshot])

  return { handleFullPageScreenshot, handleAreaScreenshot }
}

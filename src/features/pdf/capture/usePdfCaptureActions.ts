/**
 * The two capture actions, and the ladder that keeps a screenshot request from
 * dead-ending.
 *
 * | Rung | What it does                                                              |
 * | ---- | ------------------------------------------------------------------------- |
 * | 1    | direct high-DPI render from PDF.js (scale 4.0, 20 MP)                      |
 * | 2    | the mounted page canvas as a data URL, encoded off the main thread    |
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
 * Those same three events also **abort** the live render: a superseded request
 * stops rasterizing instead of finishing work nobody will use.
 *
 * ## The capture does not decide its destination
 *
 * A finished page capture is handed to `onFullPageCapture`, which parks it as a
 * *pending* capture behind the binary choice menu (AI'ye Gönder | Taslağa
 * Ekle). It is never written straight into the draft queue: the user decides,
 * exactly like a text selection or an area crop.
 */
import type { PdfActionPoint } from '@shared-core/types'

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

/** Read a Blob back as a data URL without blocking the renderer thread. */
function readBlobAsDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    } catch {
      resolve(null)
    }
  })
}

/**
 * Encode a canvas to a data URL off the main thread.
 *
 * `HTMLCanvasElement#toDataURL` runs the whole encoder synchronously, so a
 * 12 MP+ page freezes scrolling and clicks for the duration. `toBlob` hands the
 * same encoding to the browser's off-thread path; the FileReader pass that
 * follows is asynchronous too. `null` means "not encodable" and lets the caller
 * fall back to the blob-URL path.
 */
async function encodeCanvasToDataUrl(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number | undefined
): Promise<string | null> {
  if (typeof canvas.toBlob === 'function') {
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((result) => resolve(result), mime, quality)
      } catch {
        resolve(null)
      }
    })
    if (!blob) return null

    const dataUrl = await readBlobAsDataUrl(blob)
    return dataUrl && dataUrl.startsWith('data:image/') ? dataUrl : null
  }

  // Environments without `toBlob` (old test stubs): the synchronous path is the
  // only option, and it is still validated before it reaches the queue.
  if (typeof canvas.toDataURL !== 'function') return null
  try {
    const dataUrl = canvas.toDataURL(mime, quality)
    return dataUrl.startsWith('data:image/') && dataUrl !== 'data:,' ? dataUrl : null
  } catch {
    return null
  }
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
  /**
   * Tamamlanan tam sayfa yakalaması buraya iletilir; karar (gönder / taslak)
   * kullanıcıya bırakılır. Yakalama sonucu doğrudan kuyruğa yazılmaz.
   *
   * `point`, yakalamayı başlatan eylemin noktasıdır (sağ tık). Yakalama
   * asenkron tamamlandığı için nokta burada **taşınır**: karar menüsü
   * konumunu bu noktadan öğrenir, yoksa sayfanın en alt metin satırına
   * düşerdi. `null`, kısayoldan tetiklenen yollarda olur.
   */
  onFullPageCapture: (imageUri: string, meta: CaptureMeta, point?: PdfActionPoint | null) => void
  startScreenshot: (imageMeta?: CaptureMeta) => void
  pdfUrl?: string | null
}

export function usePdfCaptureActions({
  currentPage,
  totalPages,
  pdfFile,
  capturePageRef,
  onFullPageCapture,
  startScreenshot,
  pdfUrl
}: UsePdfCaptureActionsOptions) {
  const { showError, showInfo } = useToastActions()
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
  // Owns the live render task, so supersession can stop the work and not just
  // ignore its result.
  const captureAbortRef = useRef<AbortController | null>(null)

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
      // Closing the viewer must stop a render that is still running; dropping
      // the result alone would keep a 20 MP raster alive until it finished.
      captureAbortRef.current?.abort()
      captureAbortRef.current = null
    }
  }, [])

  // A capture belongs to the document it started on. When the document changes,
  // cancel the in-flight render rather than letting it burn CPU/GPU for a result
  // that can no longer be delivered.
  useEffect(() => {
    captureAbortRef.current?.abort()
    captureAbortRef.current = null
  }, [pdfUrl])

  const handleFullPageScreenshot = useCallback(
    async (point?: PdfActionPoint) => {
      const pageAtCaptureTime = currentPageRef.current
      const pdfUrlAtCaptureTime = pdfUrlRef.current
      const requestId = ++captureRequestIdRef.current
      // A newer request (or a document switch / unmount) cancels the previous
      // render through this controller. `isCurrentCapture()` still decides
      // whether a finished result may be delivered.
      captureAbortRef.current?.abort()
      const abortController = new AbortController()
      captureAbortRef.current = abortController
      const signal = abortController.signal
      // Nokta, merdivenin her basamağına aynı değerle taşınır. Render ~900 ms
      // sürebildiği için "şu an nerede tıklandı" sorusu burada bir kez yanıtlanır.
      const actionPoint = point ?? null
      const isCurrentCapture = () =>
        mountedRef.current &&
        requestId === captureRequestIdRef.current &&
        pdfUrlRef.current === pdfUrlAtCaptureTime
      // A superseded request is a normal outcome of fast page/document
      // switching, not an error. Say it once so the button does not look dead.
      let cancelNotified = false
      const notifyCancelled = () => {
        if (cancelNotified || !mountedRef.current) return
        cancelNotified = true
        showInfo('toast_capture_cancelled')
      }
      Logger.info(
        `[PdfCapture] handleFullPageScreenshot triggered for page ${pageAtCaptureTime}, hasPdfUrl=${!!pdfUrlAtCaptureTime}`
      )
      try {
        // Kalite öncelikli: pdfUrl varsa doğrudan PDF.js ile ultra yüksek çözünürlüklü
        // (scale 4.0, ~288 DPI - 4K Ultra HD) render al. Bu, ekrandaki zoom seviyesinden
        // bağımsız olarak metin ve mikroskop fotoğraflarının kristal netliğinde çıkmasını sağlar.
        if (pdfUrlAtCaptureTime) {
          try {
            const { renderPageToImageFallback } =
              await import('@features/pdf/lib/renderPageToImage')
            const rendered = await renderPageToImageFallback(
              pdfUrlAtCaptureTime,
              pageAtCaptureTime,
              {
                scale: 4.0,
                maxPixels: 20_000_000,
                signal
              }
            )
            if (!isCurrentCapture()) {
              if (rendered?.blobUrl) URL.revokeObjectURL(rendered.blobUrl)
              notifyCancelled()
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
                  notifyCancelled()
                  return
                }
                if (dataUrl.startsWith('data:image/')) {
                  onFullPageCapture(dataUrl, buildFullPageMeta(pageAtCaptureTime), actionPoint)
                  URL.revokeObjectURL(rendered.blobUrl)
                  return
                }
              } catch (readErr) {
                Logger.warn('[PdfCapture] FileReader failed:', readErr)
              }
              if (!isCurrentCapture()) {
                URL.revokeObjectURL(rendered.blobUrl)
                notifyCancelled()
                return
              }
              // Ownership of the blob URL passes to `onFullPageCapture`; the
              // draft queue revokes it when the item is removed or replaced.
              // If the hand-off itself throws, the URL stays ours to revoke.
              try {
                onFullPageCapture(
                  rendered.blobUrl,
                  buildFullPageMeta(pageAtCaptureTime),
                  actionPoint
                )
              } catch (handoffError) {
                URL.revokeObjectURL(rendered.blobUrl)
                throw handoffError
              }
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
            if (!isCurrentCapture()) {
              notifyCancelled()
              return
            }
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
                  scale: 2,
                  signal
                }
              )
              if (!isCurrentCapture()) {
                if (rendered?.blobUrl) URL.revokeObjectURL(rendered.blobUrl)
                notifyCancelled()
                return
              }
              if (rendered?.blobUrl) {
                onFullPageCapture(
                  rendered.blobUrl,
                  buildFullPageMeta(pageAtCaptureTime),
                  actionPoint
                )
                return
              }
            } catch {}
          }
          showError('toast_capture_failed')
          return
        }

        if (!isCurrentCapture()) {
          notifyCancelled()
          return
        }

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
          // `toBlob` keeps the encoder off the main thread; `toDataURL` here
          // would block scrolling and clicks for the whole encode.
          const dataUrl = await encodeCanvasToDataUrl(targetCanvas, mime, quality)
          if (!isCurrentCapture()) return
          if (dataUrl) {
            onFullPageCapture(dataUrl, buildFullPageMeta(pageAtCaptureTime), actionPoint)
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
          onFullPageCapture(result.blobUrl, buildFullPageMeta(pageAtCaptureTime), actionPoint)
        }
      } catch {
        if (isCurrentCapture()) showError('toast_capture_failed')
      }
    },
    [onFullPageCapture, showError, showInfo, buildFullPageMeta]
  )

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

import { useToastActions } from '@app/providers'
import type { AiDraftImageItem } from '@app/providers/ai/types'
import { Logger } from '@shared/lib/logger'

import { useCallback, useRef } from 'react'

import { captureCanvasAsBlob } from './captureCanvasAsBlob'
import { findPageCanvas } from './findPageCanvas'

interface UsePdfCaptureActionsOptions {
  currentPage: number
  queueImageForAi: (
    dataUrl: string,
    imageMeta?: Pick<AiDraftImageItem, 'page' | 'captureKind'>
  ) => void
  startScreenshot: (imageMeta?: Pick<AiDraftImageItem, 'page' | 'captureKind'>) => void
  pdfUrl?: string | null
}

export function usePdfCaptureActions({
  currentPage,
  queueImageForAi,
  startScreenshot,
  pdfUrl
}: UsePdfCaptureActionsOptions) {
  const { showError } = useToastActions()
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage

  const handleFullPageScreenshot = useCallback(async () => {
    const pageAtCaptureTime = currentPageRef.current
    Logger.info(
      `[PdfCapture] handleFullPageScreenshot triggered for page ${pageAtCaptureTime}, hasPdfUrl=${!!pdfUrl}`
    )
    try {
      // Kalite öncelikli: pdfUrl varsa doğrudan PDF.js ile ultra yüksek çözünürlüklü
      // (scale 4.0, ~288 DPI - 4K Ultra HD) render al. Bu, ekrandaki zoom seviyesinden
      // bağımsız olarak metin ve mikroskop fotoğraflarının kristal netliğinde çıkmasını sağlar.
      if (pdfUrl) {
        try {
          const { renderPageToImageFallback } = await import('@features/ocr/lib/renderPageToImage')
          const rendered = await renderPageToImageFallback(pdfUrl, pageAtCaptureTime, {
            scale: 4.0,
            maxPixels: 20_000_000
          })
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
              if (dataUrl.startsWith('data:image/')) {
                queueImageForAi(dataUrl, {
                  page: pageAtCaptureTime,
                  captureKind: 'full-page'
                })
                URL.revokeObjectURL(rendered.blobUrl)
                return
              }
            } catch (readErr) {
              Logger.warn('[PdfCapture] FileReader failed:', readErr)
            }
            queueImageForAi(rendered.blobUrl, {
              page: pageAtCaptureTime,
              captureKind: 'full-page'
            })
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
          targetCanvas = findPageCanvas(pageAtCaptureTime)
          if (targetCanvas) break
        }
      }

      if (!targetCanvas) {
        // Last resort: try direct PDF.js render if we have a URL. This
        // covers cases where the canvas hasn't been rasterized yet (e.g.
        // fast navigation, large document, or hidden viewer).
        if (pdfUrl) {
          try {
            const { renderPageToImageFallback } =
              await import('@features/ocr/lib/renderPageToImage')
            const rendered = await renderPageToImageFallback(pdfUrl, pageAtCaptureTime, {
              scale: 2
            })
            if (rendered?.blobUrl) {
              queueImageForAi(rendered.blobUrl, {
                page: pageAtCaptureTime,
                captureKind: 'full-page'
              })
              return
            }
          } catch {}
        }
        showError('toast_capture_failed')
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
          queueImageForAi(dataUrl, {
            page: pageAtCaptureTime,
            captureKind: 'full-page'
          })
          queued = true
        }
      } catch {}

      if (!queued) {
        let result
        try {
          result = await captureCanvasAsBlob(targetCanvas)
        } catch {
          showError('toast_capture_failed')
          return
        }
        queueImageForAi(result.blobUrl, {
          page: pageAtCaptureTime,
          captureKind: 'full-page'
        })
      }
    } catch {
      showError('toast_capture_failed')
    }
  }, [queueImageForAi, showError, pdfUrl])

  const handleAreaScreenshot = useCallback(() => {
    startScreenshot({
      page: currentPageRef.current,
      captureKind: 'selection'
    })
  }, [startScreenshot])

  return { handleFullPageScreenshot, handleAreaScreenshot }
}

import { useEffect, useCallback, useRef } from 'react'
import type { AiDraftImageItem } from '@app/providers/ai/types'
import { Logger } from '@shared/lib/logger'
import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { hasElectronApi, getElectronApi } from '@shared/lib/electronApi'

const { SCREENSHOT_TYPES } = APP_CONSTANTS

const MAX_CANVAS_AREA = 16_000_000 // ~16 MP cap to prevent OOM on high-zoom PDFs

interface UsePdfScreenshotOptions {
  currentPage: number
  queueImageForAi: (
    dataUrl: string,
    imageMeta?: Pick<AiDraftImageItem, 'page' | 'captureKind'>
  ) => void
  startScreenshot: (imageMeta?: Pick<AiDraftImageItem, 'page' | 'captureKind'>) => void
}

export function usePdfScreenshot({
  currentPage,
  queueImageForAi,
  startScreenshot
}: UsePdfScreenshotOptions) {
  const pendingBlobUrlRef = useRef<string | null>(null)
  const findPageCanvas = useCallback((): HTMLCanvasElement | null => {
    const pageNumberCandidates = [currentPage, currentPage - 1]

    for (const pageNumber of pageNumberCandidates) {
      const layer = document.querySelector(
        `.rpv-core__page-layer[data-page-number="${pageNumber}"]`
      )
      if (!layer) continue

      const canvas = layer.querySelector('canvas') as HTMLCanvasElement | null
      if (canvas && canvas.width > 0 && canvas.height > 0) return canvas
    }

    const allCanvases = Array.from(
      document.querySelectorAll<HTMLCanvasElement>('.rpv-core__page-layer canvas')
    )

    let bestCandidate: HTMLCanvasElement | null = null
    let nearestPageDistance = Number.POSITIVE_INFINITY
    let maxVisibleArea = -1

    for (const canvas of allCanvases) {
      if (canvas.width === 0 || canvas.height === 0) continue

      const rect = canvas.getBoundingClientRect()
      const vTop = Math.max(0, rect.top)
      const vBottom = Math.min(window.innerHeight, rect.bottom)
      const vLeft = Math.max(0, rect.left)
      const vRight = Math.min(window.innerWidth, rect.right)

      if (vBottom <= vTop || vRight <= vLeft) continue

      const visibleArea = (vBottom - vTop) * (vRight - vLeft)
      const layer = canvas.closest('.rpv-core__page-layer') as HTMLElement | null
      const layerPage = Number(layer?.dataset?.pageNumber ?? Number.NaN)
      const dist = Number.isFinite(layerPage)
        ? Math.abs(layerPage - currentPage)
        : Number.POSITIVE_INFINITY

      if (
        dist < nearestPageDistance ||
        (dist === nearestPageDistance && visibleArea > maxVisibleArea)
      ) {
        nearestPageDistance = dist
        maxVisibleArea = visibleArea
        bestCandidate = canvas
      }
    }

    if (bestCandidate) return bestCandidate

    const fallback = document.querySelector(
      '.pdf-viewer-container canvas'
    ) as HTMLCanvasElement | null
    return fallback && fallback.width > 0 ? fallback : null
  }, [currentPage])

  const handleFullPageScreenshot = useCallback(async () => {
    try {
      let targetCanvas = findPageCanvas()

      if (!targetCanvas) {
        const MAX_RETRIES = 6
        for (let i = 0; i < MAX_RETRIES; i++) {
          await new Promise((r) => setTimeout(r, 40))
          targetCanvas = findPageCanvas()
          if (targetCanvas) break
        }
      }

      if (!targetCanvas) {
        Logger.warn('[PdfScreenshot] Canvas bulunamadı, ekran görüntüsü alınamıyor.')
        return
      }

      const canvasArea = targetCanvas.width * targetCanvas.height
      const useJpeg = canvasArea > MAX_CANVAS_AREA
      const mimeType = useJpeg ? 'image/jpeg' : 'image/png'
      const quality = useJpeg ? 0.85 : undefined

      targetCanvas.toBlob(
        (blob) => {
          if (!blob) {
            Logger.warn('[PdfScreenshot] Canvas toBlob failed.')
            return
          }

          if (pendingBlobUrlRef.current) {
            URL.revokeObjectURL(pendingBlobUrlRef.current)
            pendingBlobUrlRef.current = null
          }

          const blobUrl = URL.createObjectURL(blob)
          pendingBlobUrlRef.current = blobUrl
          queueImageForAi(blobUrl, {
            page: currentPage,
            captureKind: 'full-page'
          })
        },
        mimeType,
        quality
      )
    } catch (error) {
      Logger.error('[PdfScreenshot] Full page capture error:', error)
    }
  }, [currentPage, findPageCanvas, queueImageForAi])

  useEffect(() => {
    if (!hasElectronApi()) return

    const removeListener = getElectronApi().onTriggerScreenshot((type) => {
      if (type === SCREENSHOT_TYPES.CROP) {
        startScreenshot({
          page: currentPage,
          captureKind: 'selection'
        })
      } else if (type === SCREENSHOT_TYPES.FULL) {
        void handleFullPageScreenshot()
      }
    })

    return () => {
      if (typeof removeListener === 'function') removeListener()
      if (pendingBlobUrlRef.current) {
        URL.revokeObjectURL(pendingBlobUrlRef.current)
        pendingBlobUrlRef.current = null
      }
    }
  }, [currentPage, handleFullPageScreenshot, startScreenshot])

  return { handleFullPageScreenshot }
}

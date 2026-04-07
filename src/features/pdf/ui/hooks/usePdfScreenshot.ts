import { useEffect, useCallback } from 'react'
import type { AiDraftImageItem } from '@app/providers/ai/types'
import { Logger } from '@shared/lib/logger'
import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { hasElectronApi, getElectronApi } from '@shared/lib/electronApi'

const { SCREENSHOT_TYPES } = APP_CONSTANTS

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

      const dataUrl = targetCanvas.toDataURL('image/png')
      queueImageForAi(dataUrl, {
        page: currentPage,
        captureKind: 'full-page'
      })
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
    }
  }, [currentPage, handleFullPageScreenshot, startScreenshot])

  return { handleFullPageScreenshot }
}

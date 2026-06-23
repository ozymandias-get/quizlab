import { useToastActions } from '@app/providers'
import type { AiDraftImageItem } from '@app/providers/ai/types'

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
}

export function usePdfCaptureActions({
  currentPage,
  queueImageForAi,
  startScreenshot
}: UsePdfCaptureActionsOptions) {
  const { showError } = useToastActions()
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage

  const handleFullPageScreenshot = useCallback(async () => {
    const pageAtCaptureTime = currentPageRef.current
    try {
      let targetCanvas = findPageCanvas(pageAtCaptureTime)

      if (!targetCanvas) {
        const MAX_RETRIES = 6
        for (let i = 0; i < MAX_RETRIES; i++) {
          await new Promise((r) => setTimeout(r, 40))
          targetCanvas = findPageCanvas(pageAtCaptureTime)
          if (targetCanvas) break
        }
      }

      if (!targetCanvas) {
        return
      }

      const result = await captureCanvasAsBlob(targetCanvas)

      queueImageForAi(result.blobUrl, {
        page: pageAtCaptureTime,
        captureKind: 'full-page'
      })
    } catch {
      showError('toast_capture_failed')
    }
  }, [queueImageForAi, showError])

  const handleAreaScreenshot = useCallback(() => {
    startScreenshot({
      page: currentPageRef.current,
      captureKind: 'selection'
    })
  }, [startScreenshot])

  return { handleFullPageScreenshot, handleAreaScreenshot }
}

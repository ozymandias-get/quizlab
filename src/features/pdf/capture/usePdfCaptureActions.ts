/**
 * React hook for PDF capture actions: full-page screenshot and area selection.
 * Uses the Capture Engine for canvas discovery and blob lifecycle.
 */
import { useCallback, useRef, useEffect } from 'react'
import { findPageCanvas } from './findPageCanvas'
import { captureCanvasAsBlob, revokeCaptureUrl } from './captureCanvasAsBlob'
import type { AiDraftImageItem } from '@app/providers/ai/types'

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
  const pendingBlobUrlRef = useRef<string | null>(null)

  const handleFullPageScreenshot = useCallback(async () => {
    try {
      let targetCanvas = findPageCanvas(currentPage)

      if (!targetCanvas) {
        const MAX_RETRIES = 6
        for (let i = 0; i < MAX_RETRIES; i++) {
          await new Promise((r) => setTimeout(r, 40))
          targetCanvas = findPageCanvas(currentPage)
          if (targetCanvas) break
        }
      }

      if (!targetCanvas) {
        return
      }

      const result = await captureCanvasAsBlob(targetCanvas)

      if (pendingBlobUrlRef.current) {
        revokeCaptureUrl(pendingBlobUrlRef.current)
      }

      pendingBlobUrlRef.current = result.blobUrl
      queueImageForAi(result.blobUrl, {
        page: currentPage,
        captureKind: 'full-page'
      })
    } catch {
      // Capture failed silently — caller should handle via toast if needed
    }
  }, [currentPage, queueImageForAi])

  const handleAreaScreenshot = useCallback(() => {
    startScreenshot({
      page: currentPage,
      captureKind: 'selection'
    })
  }, [currentPage, startScreenshot])

  useEffect(() => {
    return () => {
      if (pendingBlobUrlRef.current) {
        revokeCaptureUrl(pendingBlobUrlRef.current)
        pendingBlobUrlRef.current = null
      }
    }
  }, [])

  return { handleFullPageScreenshot, handleAreaScreenshot }
}

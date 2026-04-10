import { useCallback, useRef } from 'react'
import { useScreenshot } from '@features/screenshot'
import type { QueuedImageMeta } from './useAiDraftQueue'

interface UseScreenshotPipelineProps {
  queueImageForAi: (dataUrl: string, imageMeta?: QueuedImageMeta) => void
  clearPendingAiItemsExtras?: () => void
}

export function useScreenshotPipeline({
  queueImageForAi,
  clearPendingAiItemsExtras
}: UseScreenshotPipelineProps) {
  const screenshotMetaRef = useRef<QueuedImageMeta | null>(null)

  const onScreenshotCapture = useCallback(
    async (dataUrl: string) => {
      queueImageForAi(dataUrl, screenshotMetaRef.current ?? undefined)
      screenshotMetaRef.current = null
    },
    [queueImageForAi]
  )

  const {
    isScreenshotMode,
    startScreenshot: beginScreenshot,
    closeScreenshot: closeRawScreenshot,
    handleCapture: captureScreenshot
  } = useScreenshot(onScreenshotCapture)

  const startScreenshot = useCallback(
    (imageMeta?: QueuedImageMeta) => {
      screenshotMetaRef.current = imageMeta ?? null
      beginScreenshot()
    },
    [beginScreenshot]
  )

  const closeScreenshot = useCallback(() => {
    screenshotMetaRef.current = null
    closeRawScreenshot()
  }, [closeRawScreenshot])

  const handleCapture = useCallback(
    async (dataUrl: string) => {
      try {
        await captureScreenshot(dataUrl)
      } finally {
        screenshotMetaRef.current = null
      }
    },
    [captureScreenshot]
  )

  const clearScreenshotMeta = useCallback(() => {
    screenshotMetaRef.current = null
    clearPendingAiItemsExtras?.()
  }, [clearPendingAiItemsExtras])

  return {
    isScreenshotMode,
    startScreenshot,
    closeScreenshot,
    handleCapture,
    clearScreenshotMeta
  }
}

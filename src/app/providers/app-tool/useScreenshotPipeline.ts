import { useScreenshot } from '@features/screenshot/hooks/useScreenshot'

import { useCallback, useRef } from 'react'

import type { QueuedImageMeta } from './useAiDraftQueue'

interface UseScreenshotPipelineProps {
  queueImageForAi: (dataUrl: string, imageMeta?: QueuedImageMeta) => void
}

export function useScreenshotPipeline({ queueImageForAi }: UseScreenshotPipelineProps) {
  const screenshotMetaRef = useRef<QueuedImageMeta | null>(null)

  const handleScreenshotCapture = useCallback(
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
  } = useScreenshot(handleScreenshotCapture)

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
  }, [])

  return {
    isScreenshotMode,
    startScreenshot,
    closeScreenshot,
    handleCapture,
    clearScreenshotMeta
  }
}

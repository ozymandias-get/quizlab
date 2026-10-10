import { useScreenshot } from '@features/screenshot'

import { useCallback, useRef, useState } from 'react'

import type { QueuedImageMeta } from './useAiDraftQueue'

export interface PendingAreaCapture {
  dataUrl: string
  meta: QueuedImageMeta | null
  rect: { left: number; top: number; width: number; height: number } | null
}

interface UseScreenshotPipelineProps {
  queueImageForAi: (dataUrl: string, imageMeta?: QueuedImageMeta) => void
}

export function useScreenshotPipeline({ queueImageForAi }: UseScreenshotPipelineProps) {
  const screenshotMetaRef = useRef<QueuedImageMeta | null>(null)
  const [pendingAreaCapture, setPendingAreaCapture] = useState<PendingAreaCapture | null>(null)
  const pendingAreaCaptureRef = useRef<PendingAreaCapture | null>(null)
  pendingAreaCaptureRef.current = pendingAreaCapture

  const handleScreenshotCapture = useCallback(
    async (dataUrl: string, rect?: PendingAreaCapture['rect']) => {
      // Alan seçimi tamamlandı: doğrudan kuyruğa yazma. İkili menü
      // (AI'ye Gönder / Taslağa Ekle) karar verene kadar beklet.
      const meta = screenshotMetaRef.current
      screenshotMetaRef.current = null
      setPendingAreaCapture({ dataUrl, meta, rect: rect ?? null })
    },
    []
  )

  const {
    isScreenshotMode,
    startScreenshot: beginScreenshot,
    closeScreenshot: closeRawScreenshot,
    handleCapture: captureScreenshot
  } = useScreenshot(handleScreenshotCapture)

  const startScreenshot = useCallback(
    (imageMeta?: QueuedImageMeta) => {
      // Yeni alan seçimi eski bekleyeni geçersiz kılar (hızlı arka arkaya seçim).
      setPendingAreaCapture(null)
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
    async (
      dataUrl: string,
      rect?: { left: number; top: number; width: number; height: number } | null
    ) => {
      try {
        await captureScreenshot(dataUrl, rect as never)
      } finally {
        screenshotMetaRef.current = null
      }
    },
    [captureScreenshot]
  )

  const confirmPendingAreaAsDraft = useCallback(() => {
    const pending = pendingAreaCaptureRef.current
    if (!pending) return false
    queueImageForAi(pending.dataUrl, pending.meta ?? undefined)
    setPendingAreaCapture(null)
    return true
  }, [queueImageForAi])

  const dismissPendingArea = useCallback(() => {
    setPendingAreaCapture(null)
  }, [])

  const clearScreenshotMeta = useCallback(() => {
    screenshotMetaRef.current = null
  }, [])

  return {
    isScreenshotMode,
    pendingAreaCapture,
    startScreenshot,
    closeScreenshot,
    handleCapture,
    confirmPendingAreaAsDraft,
    dismissPendingArea,
    clearScreenshotMeta
  }
}

import { useScreenshot } from '@features/screenshot'

import { useCallback, useRef, useState } from 'react'

import type { QueuedImageMeta } from './useAiDraftQueue'

export interface PendingAreaCapture {
  dataUrl: string
  meta: QueuedImageMeta | null
  rect: { left: number; top: number; width: number; height: number } | null
}

export interface PendingFullPageCapture {
  dataUrl: string
  meta: QueuedImageMeta | null
}

/** Blob URL ise geri al (kullanıcı menüde vazgeçerse sızmasın). */
function revokeIfBlobUrl(url: string) {
  if (url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // best-effort
    }
  }
}

interface UseScreenshotPipelineProps {
  queueImageForAi: (dataUrl: string, imageMeta?: QueuedImageMeta) => boolean
}

/**
 * Yakalama → karar hattı.
 *
 * Alan ve tam sayfa görselleri artık doğrudan kuyruğa yazılmaz: ikisi de
 * "bekleyen yakalama" olarak tutulur ve kullanıcı ikili menüde (AI'ye Gönder |
 * Taslağa Ekle) karar verene kadar bekler. Kullanıcı vazgeçerse blob URL'i
 * geri alınır; yeni bir yakalama eski bekleyeni geçersiz kılar.
 */
export function useScreenshotPipeline({ queueImageForAi }: UseScreenshotPipelineProps) {
  const screenshotMetaRef = useRef<QueuedImageMeta | null>(null)
  const [pendingAreaCapture, setPendingAreaCapture] = useState<PendingAreaCapture | null>(null)
  const pendingAreaCaptureRef = useRef<PendingAreaCapture | null>(null)
  pendingAreaCaptureRef.current = pendingAreaCapture
  const [pendingFullPageCapture, setPendingFullPageCapture] =
    useState<PendingFullPageCapture | null>(null)
  const pendingFullPageCaptureRef = useRef<PendingFullPageCapture | null>(null)
  pendingFullPageCaptureRef.current = pendingFullPageCapture

  const handleScreenshotCapture = useCallback(
    async (dataUrl: string, rect?: PendingAreaCapture['rect']) => {
      // Alan seçimi tamamlandı: doğrudan kuyruğa yazma. İkili menü
      // (AI'ye Gönder / Taslağa Ekle) karar verene kadar beklet.
      const meta = screenshotMetaRef.current
      screenshotMetaRef.current = null
      const prev = pendingAreaCaptureRef.current
      if (prev) revokeIfBlobUrl(prev.dataUrl)
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
      const prev = pendingAreaCaptureRef.current
      if (prev) revokeIfBlobUrl(prev.dataUrl)
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
    const prev = pendingAreaCaptureRef.current
    if (prev) revokeIfBlobUrl(prev.dataUrl)
    setPendingAreaCapture(null)
  }, [])

  /**
   * Tam sayfa yakalama tamamlandı: bekleyen yakalama olarak tut, kullanıcının
   * kararını bekle. Kendiliğinden taslağa eklenmez.
   */
  const offerFullPageCapture = useCallback((dataUrl: string, meta?: QueuedImageMeta | null) => {
    const prev = pendingFullPageCaptureRef.current
    if (prev) revokeIfBlobUrl(prev.dataUrl)
    setPendingFullPageCapture({ dataUrl, meta: meta ?? null })
  }, [])

  const confirmPendingFullPageAsDraft = useCallback(() => {
    const pending = pendingFullPageCaptureRef.current
    if (!pending) return false
    queueImageForAi(pending.dataUrl, pending.meta ?? undefined)
    setPendingFullPageCapture(null)
    return true
  }, [queueImageForAi])

  const dismissPendingFullPage = useCallback(() => {
    const prev = pendingFullPageCaptureRef.current
    if (prev) revokeIfBlobUrl(prev.dataUrl)
    setPendingFullPageCapture(null)
  }, [])

  const clearScreenshotMeta = useCallback(() => {
    screenshotMetaRef.current = null
  }, [])

  return {
    isScreenshotMode,
    pendingAreaCapture,
    pendingFullPageCapture,
    startScreenshot,
    closeScreenshot,
    handleCapture,
    confirmPendingAreaAsDraft,
    dismissPendingArea,
    offerFullPageCapture,
    confirmPendingFullPageAsDraft,
    dismissPendingFullPage,
    clearScreenshotMeta
  }
}

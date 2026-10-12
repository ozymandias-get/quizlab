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
 *
 * ## Sahiplik
 *
 * Bekleyen yakalama, kaynak URL'inin sahibidir. `confirm*AsDraft` yalnızca
 * kuyruk gerçekten kabul ettiğinde bu sahipliği devreder; reddedildiğinde
 * bekleyen yakalama **korunur** (kullanıcı öğeleri azaltıp yeniden deneyebilir)
 * ve kaynak ne iptal edilir ne de kaybolur.
 *
 * ## Sonucun yayılması
 *
 * `confirm*AsDraft`, `queueImageForAi`'nin gerçek boolean sonucunu döndürür.
 * Çağıran bu sonucu kontrol etmezse, reddedilen bir ekleme kullanıcıya
 * "Taslağa eklendi" diye gösterilir — bu yüzden dönüş anlamlıdır.
 */
export function useScreenshotPipeline({ queueImageForAi }: UseScreenshotPipelineProps) {
  const screenshotMetaRef = useRef<QueuedImageMeta | null>(null)
  const [areaCapture, setAreaCapture] = useState<PendingAreaCapture | null>(null)
  // Ref render'da değil, **mutasyon anında** güncellenir: aynı olay içinde
  // gelen iki yakalama birbirini göremez ve ilki sızmasın.
  const pendingAreaCaptureRef = useRef<PendingAreaCapture | null>(null)
  const [fullPageCapture, setFullPageCapture] = useState<PendingFullPageCapture | null>(null)
  const pendingFullPageCaptureRef = useRef<PendingFullPageCapture | null>(null)

  const setPendingAreaCapture = useCallback((next: PendingAreaCapture | null) => {
    pendingAreaCaptureRef.current = next
    setAreaCapture(next)
  }, [])

  const setPendingFullPageCapture = useCallback((next: PendingFullPageCapture | null) => {
    pendingFullPageCaptureRef.current = next
    setFullPageCapture(next)
  }, [])

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
    [setPendingAreaCapture]
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
    [beginScreenshot, setPendingAreaCapture]
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
    // Kuyruk sonucunu YAY: kabul edilirse sahiplik kuyruğa geçer ve bekleyen
    // yakalama temizlenir. Reddedilirse (kuyruk dolu / geçersiz kaynak)
    // bekleyen yakalama korunur — kullanıcı öğeleri azaltıp yeniden deneyebilir
    // ve kaynak ne iptal edilir ne de sessizce kaybolur.
    const accepted = queueImageForAi(pending.dataUrl, pending.meta ?? undefined)
    if (!accepted) return false
    setPendingAreaCapture(null)
    return true
  }, [queueImageForAi, setPendingAreaCapture])

  const dismissPendingArea = useCallback(() => {
    const prev = pendingAreaCaptureRef.current
    if (prev) revokeIfBlobUrl(prev.dataUrl)
    setPendingAreaCapture(null)
  }, [setPendingAreaCapture])

  /**
   * Tam sayfa yakalama tamamlandı: bekleyen yakalama olarak tut, kullanıcının
   * kararını bekle. Kendiliğinden taslağa eklenmez.
   */
  const offerFullPageCapture = useCallback(
    (dataUrl: string, meta?: QueuedImageMeta | null) => {
      const prev = pendingFullPageCaptureRef.current
      if (prev) revokeIfBlobUrl(prev.dataUrl)
      setPendingFullPageCapture({ dataUrl, meta: meta ?? null })
    },
    [setPendingFullPageCapture]
  )

  const confirmPendingFullPageAsDraft = useCallback(() => {
    const pending = pendingFullPageCaptureRef.current
    if (!pending) return false
    // Alan yakalamasıyla aynı sözleşme: kabul edilirse sahiplik devreder,
    // reddedilirse bekleyen yakalama korunur.
    const accepted = queueImageForAi(pending.dataUrl, pending.meta ?? undefined)
    if (!accepted) return false
    setPendingFullPageCapture(null)
    return true
  }, [queueImageForAi, setPendingFullPageCapture])

  const dismissPendingFullPage = useCallback(() => {
    const prev = pendingFullPageCaptureRef.current
    if (prev) revokeIfBlobUrl(prev.dataUrl)
    setPendingFullPageCapture(null)
  }, [setPendingFullPageCapture])

  const clearScreenshotMeta = useCallback(() => {
    screenshotMetaRef.current = null
  }, [])

  return {
    isScreenshotMode,
    pendingAreaCapture: areaCapture,
    pendingFullPageCapture: fullPageCapture,
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

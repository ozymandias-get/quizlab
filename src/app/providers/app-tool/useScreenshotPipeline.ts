import { useScreenshot } from '@features/screenshot'

import { useCallback, useRef, useState } from 'react'

import type { QueuedImageMeta, QueuedTextMeta } from './useAiDraftQueue'

/**
 * Bir yakalamanın **kimliği**.
 *
 * `dataUrl` bir kimlik **değildir**: aynı bölge iki kez yakalanabilir, iki
 * yakalama da `blob:` üretmeyen yollardan aynı `data:` URL'ini verebilir.
 * Kimliğin kaynağa bağlanması, bir gönderim sürerken gelen ikinci bir
 * yakalamanın "aynı yakalama" sanılmasına ve ilk gönderimin tamamlanırken
 * onu silmesine yol açar. Bu yüzden kimlik, kaynaktan **tamamen ayrı** ve
 * her yakalama için benzersizdir.
 *
 * `kind`, kaynağın türünü de taşır: `area:<n>` ve `full:<n>` aynı sayıyı
 * paylaşsa bile farklı yakalamalardır.
 */
export type CaptureId = string

export interface PendingAreaCapture {
  id: CaptureId
  dataUrl: string
  meta: QueuedImageMeta | null
  rect: { left: number; top: number; width: number; height: number } | null
}

export interface PendingFullPageCapture {
  id: CaptureId
  dataUrl: string
  meta: QueuedImageMeta | null
}

/**
 * Tam sayfa metni için bekleyen karar.
 *
 * Görsellerin aksine metnin bir `dataUrl`'i yoktur; içerik doğrudan `text`
 * alanında taşınır ve **blob geri alma sorunu olmaz**. Yine de aynı sözleşmeye
 * girer: kuyruğa doğrudan yazılmaz, ikili menüde karar verilir.
 *
 * Öncesi: "Bu Sayfanın Metnini AI'ye Ekle" `queueTextForAi`'yi doğrudan
 * çağırıyordu, yani kullanıcı yalnızca "Taslağa Ekle" seçeneğine sahipti ve
 * görsel yolun menüsüyle tutarsızdı.
 */
export interface PendingFullPageTextCapture {
  id: CaptureId
  text: string
  meta: QueuedTextMeta | null
}

/** Uygulama yaşamı boyunca benzersiz yakalama kimlikleri. */
let captureSeq = 0
function nextCaptureId(kind: 'area' | 'full' | 'text'): CaptureId {
  captureSeq += 1
  return `${kind}:${captureSeq}`
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
  /**
   * Metni kuyruğa yazar. Bekleyen metnin "Taslağa Ekle" yolu bunu çağırır ve
   * gerçek boolean sonucunu döner (reddedilirse bekleyen yakalama korunur).
   */
  queueTextForAi: (text: string, position?: null, meta?: QueuedTextMeta | null) => boolean
}

/**
 * Yakalama → karar hattı.
 *
 * Alan ve tam sayfa görselleri artık doğrudan kuyruğa yazılmaz: ikisi de
 * "bekleyen yakalama" olarak tutulur ve kullanıcı ikili menüde (AI'ye Gönder |
 * Taslağa Ekle) karar verene kadar bekler. Kullanıcı vazgeçerse blob URL'i
 * geri alınır; yeni bir yakalama eski bekleyeni geçersiz kılar.
 *
 * **Tam sayfa metni de aynı sözleşmede.** Öncesi "Bu Sayfanın Metnini AI'ye
 * Ekle" doğrudan `queueTextForAi` çağırıyordu: kullanıcının yalnızca "Taslağa
 * Ekle" seçeneği vardı ve iki yol birbirinden ayrışıyordu.
 *
 * ## Tek sahiplik
 *
 * Üç tür için ayrı state tutulur (dış API böyle), ama **aynı anda yalnızca biri
 * dolu olabilir**: yeni bir yakalama geldiğinde diğerleri kaynaklarıyla birlikte
 * düşürülür. Aksi halde "hangi yakalama ekleniyor / gönderiliyor / temizleniyor?"
 * sorusunun tek ve deterministik bir yanıtı olmazdı — menü alan yakalamasını
 * gösterirken tam sayfa yakalamasının kaynağı ekranda görünmeden yaşar ve
 * sessizce sızardı.
 *
 * Kimlik (`id`) kaynaktan ayrıdır; "hangi yakalama?" sorusunun yanıtıdır ve
 * tek sahiplik kuralından **farklıdır**: aynı anda tek bekleyen yakalama
 * olabilir, ama o sırada birden fazla gönderim kaynağı okuyor olabilir.
 *
 * ## Sahiplik ve kaynak yaşam döngüsü
 *
 * Bekleyen yakalama, kaynak URL'inin sahibidir. `confirm*AsDraft` yalnızca
 * kuyruk gerçekten kabul ettiğinde bu sahipliği devreder; reddedildiğinde
 * bekleyen yakalama **korunur** (kullanıcı öğeleri azaltıp yeniden deneyebilir)
 * ve kaynak ne iptal edilir ne de kaybolur.
 *
 * Üçüncü bir sahip vardır: **süren gönderim**. Gönderim, kaynağı okurken
 * (`blob:` → `data:` dönüşümü) yeni bir yakalama gelirse kaynak erken geri
 * alınırsa gönderim boş ya da okunamayan bir kaynakla karşılaşır. Bunun için
 * `retainCaptureSource` / `releaseCaptureSource` ikilisi vardır:
 *
 * - `retain`: kaynağa **okunmakta olan bir işlem** var; düşürme anında iptal
 *   edilmez, "sonra geri al" listesine alınır.
 * - `release`: işlem bitti. Bekleyen bir iptal varsa **şimdi** geri alınır.
 *
 * Böylece "gönderim sürerken kaynak erken iptal edilmez" ve "gönderim
 * bittikten sonra kullanılmayan kaynak kalmaz" aynı mekanizmayla sağlanır;
 * genel bir kaynak yönetim sistemi yazılmaz.
 *
 * ## Sonucun yayılması
 *
 * `confirm*AsDraft`, `queueImageForAi`'nin gerçek boolean sonucunu döndürür.
 * Çağıran bu sonucu kontrol etmezse, reddedilen bir ekleme kullanıcıya
 * "Taslağa eklendi" diye gösterilir — bu yüzden dönüş anlamlıdır.
 */
export function useScreenshotPipeline({
  queueImageForAi,
  queueTextForAi
}: UseScreenshotPipelineProps) {
  const screenshotMetaRef = useRef<QueuedImageMeta | null>(null)
  const [areaCapture, setAreaCapture] = useState<PendingAreaCapture | null>(null)
  // Ref render'da değil, **mutasyon anında** güncellenir: aynı olay içinde
  // gelen iki yakalama birbirini göremez ve ilki sızmasın.
  const pendingAreaCaptureRef = useRef<PendingAreaCapture | null>(null)
  const [fullPageCapture, setFullPageCapture] = useState<PendingFullPageCapture | null>(null)
  const pendingFullPageCaptureRef = useRef<PendingFullPageCapture | null>(null)
  const [fullPageTextCapture, setFullPageTextCapture] = useState<PendingFullPageTextCapture | null>(
    null
  )
  const pendingFullPageTextRef = useRef<PendingFullPageTextCapture | null>(null)

  /** Kaynağını hâlâ okuyan (gönderimde olan) yakalamalar. */
  const retainedSourceIdsRef = useRef<Set<CaptureId>>(new Set())
  /** Gönderim bittiği için iptali ertelenen kaynaklar: `id → url`. */
  const deferredRevocationsRef = useRef<Map<CaptureId, string>>(new Map())

  /** Bu URL hâlâ canlı bir yakalamanın sorumluluğunda mı? */
  const isUrlStillOwned = useCallback((url: string) => {
    return (
      pendingAreaCaptureRef.current?.dataUrl === url ||
      pendingFullPageCaptureRef.current?.dataUrl === url
    )
  }, [])

  /**
   * Yakalamanın kaynağını bırakır (yakalama düşürülüyor).
   *
   * Kaynak bir gönderim tarafından okunuyorsa **ertelenir**: `revoke` erken
   * yapılırsa süren gönderim kaynağı okuyamaz. Aksine hiçbir işlem tutmuyorsa
   * hemen geri alınır — ekranda görülmeyen bir blob sızmaz.
   */
  const dropCaptureSource = useCallback((id: CaptureId, dataUrl: string) => {
    if (!dataUrl.startsWith('blob:')) return
    if (retainedSourceIdsRef.current.has(id)) {
      deferredRevocationsRef.current.set(id, dataUrl)
      return
    }
    revokeIfBlobUrl(dataUrl)
  }, [])

  const setPendingAreaCapture = useCallback((next: PendingAreaCapture | null) => {
    pendingAreaCaptureRef.current = next
    setAreaCapture(next)
  }, [])

  const setPendingFullPageCapture = useCallback((next: PendingFullPageCapture | null) => {
    pendingFullPageCaptureRef.current = next
    setFullPageCapture(next)
  }, [])

  const setPendingFullPageText = useCallback((next: PendingFullPageTextCapture | null) => {
    pendingFullPageTextRef.current = next
    setFullPageTextCapture(next)
  }, [])

  /**
   * Diğer türlerin bekleyen yakalamasını kaynaklarıyla birlikte düşürür.
   *
   * Metin de bu kapsama girer: aynı anda tek bir bekleyen yakalama olabilir.
   * Görsellerin `dataUrl`'i vardır ve blob ise geri alınır; **metinde kaynak
   * yoktur**, düşürmek yalnızca durumu temizler.
   */
  const dropOtherPendingCapture = useCallback(() => {
    const otherFull = pendingFullPageCaptureRef.current
    if (otherFull) {
      dropCaptureSource(otherFull.id, otherFull.dataUrl)
      // Ref + state birlikte düşer; sahiplik kaydı tek yerden yürütülür
      // (doğrudan `setFullPageCapture` çağırmak ikinci bir yazma yoludur).
      setPendingFullPageCapture(null)
    }
    setPendingFullPageText(null)
  }, [dropCaptureSource, setPendingFullPageCapture, setPendingFullPageText])

  const handleScreenshotCapture = useCallback(
    async (dataUrl: string, rect?: PendingAreaCapture['rect']) => {
      // Alan seçimi tamamlandı: doğrudan kuyruğa yazma. İkili menü
      // (AI'ye Gönder / Taslağa Ekle) karar verene kadar beklet.
      const meta = screenshotMetaRef.current
      screenshotMetaRef.current = null
      const prev = pendingAreaCaptureRef.current
      // Yeni yakalama eskiyi **kimliğiyle** geçersiz kılar; kaynak, üzerinde
      // süren bir gönderim varsa ertelenir (bkz. `dropCaptureSource`).
      if (prev) dropCaptureSource(prev.id, prev.dataUrl)
      dropOtherPendingCapture()
      setPendingAreaCapture({ id: nextCaptureId('area'), dataUrl, meta, rect: rect ?? null })
    },
    [dropCaptureSource, dropOtherPendingCapture, setPendingAreaCapture]
  )

  const {
    isScreenshotMode,
    startScreenshot: beginScreenshot,
    closeScreenshot: closeRawScreenshot,
    handleCapture: captureScreenshot
  } = useScreenshot(handleScreenshotCapture)

  const startScreenshot = useCallback(
    (imageMeta?: QueuedImageMeta) => {
      // Yeni alan seçimi eski bekleyeni geçersiz kılar (hızlı arka arkaya seçim)
      // ve tam sayfa yakalaması da aynı anda bekleyemez.
      const prev = pendingAreaCaptureRef.current
      if (prev) dropCaptureSource(prev.id, prev.dataUrl)
      setPendingAreaCapture(null)
      dropOtherPendingCapture()
      screenshotMetaRef.current = imageMeta ?? null
      beginScreenshot()
    },
    [beginScreenshot, dropCaptureSource, dropOtherPendingCapture, setPendingAreaCapture]
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

  const dismissPendingArea = useCallback(() => {
    const prev = pendingAreaCaptureRef.current
    if (prev) dropCaptureSource(prev.id, prev.dataUrl)
    setPendingAreaCapture(null)
  }, [dropCaptureSource, setPendingAreaCapture])

  /**
   * Bekleyen yakalamanın kaynağı, üzerinde süren bir gönderim olduğunu bildirir.
   *
   * Gönderim başlarken **senkron** çağrılır: kaynak daha sonra düşürülse bile
   * iptal edilmez. Çağıran, işlem bitince `releaseCaptureSource` ile eşleştirir.
   */
  const retainCaptureSource = useCallback((id: CaptureId) => {
    retainedSourceIdsRef.current.add(id)
  }, [])

  /**
   * Gönderim bitti: kaynağın tutulmaktan çıkmasına izin ver.
   *
   * Düşme sırasında iptal edilemeyen kaynak **şimdi** geri alınır. Böylece
   * "gönderim sürerken kaynak yaşar, gönderim bitince kullanılmayan kaynak
   * kalmaz" kuralı tek yerde ve sızıntısız uygulanır.
   */
  const releaseCaptureSource = useCallback(
    (id: CaptureId) => {
      retainedSourceIdsRef.current.delete(id)
      const url = deferredRevocationsRef.current.get(id)
      if (url === undefined) return
      deferredRevocationsRef.current.delete(id)
      // Aynı URL'i kullanan **başka bir canlı yakalama** varsa iptal yapılmaz:
      // kimlik başka, kaynak paylaşılan.
      if (isUrlStillOwned(url)) return
      revokeIfBlobUrl(url)
    },
    [isUrlStillOwned]
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

  /**
   * Tam sayfa yakalama tamamlandı: bekleyen yakalama olarak tut, kullanıcının
   * kararını bekle. Kendiliğinden taslağa eklenmez.
   */
  const offerFullPageCapture = useCallback(
    (dataUrl: string, meta?: QueuedImageMeta | null) => {
      const prev = pendingFullPageCaptureRef.current
      if (prev) dropCaptureSource(prev.id, prev.dataUrl)
      // Tek sahiplik: aynı anda bekleyen bir alan yakalaması varsa düşürülür.
      const pendingArea = pendingAreaCaptureRef.current
      if (pendingArea) {
        dropCaptureSource(pendingArea.id, pendingArea.dataUrl)
        pendingAreaCaptureRef.current = null
        setAreaCapture(null)
      }
      // Bekleyen tam sayfa metni de düşer: aynı anda tek bekleyen yakalama
      // olabilir. Aksi halde menü görseli gösterirken metin ekranda görünmeden
      // yaşar ve kullanıcı onu ne gönderebilir ne iptal edebilir.
      setPendingFullPageText(null)
      setPendingFullPageCapture({ id: nextCaptureId('full'), dataUrl, meta: meta ?? null })
    },
    [dropCaptureSource, setPendingFullPageCapture, setPendingFullPageText]
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
    if (prev) dropCaptureSource(prev.id, prev.dataUrl)
    setPendingFullPageCapture(null)
  }, [dropCaptureSource, setPendingFullPageCapture])

  /**
   * Tam sayfa metni çıkarıldı: bekleyen yakalama olarak tut, kararı kullanıcıya
   * bırak. Görsel yollarla **aynı sözleşme** — kuyruğa doğrudan yazılmaz.
   *
   * Boş metin bir yakalama sayılmaz: çıkarım başarısız olduğunda
   * `onNoTextFound` uyarısı zaten gösteriliyor ve menü açılması yanıltıcı
   * olurdu.
   */
  const offerFullPageText = useCallback(
    (text: string, meta?: QueuedTextMeta | null) => {
      if (!text || !text.trim()) return
      // Tek sahiplik: yeni metin yakalaması geldiğinde bekleyen görseller
      // kaynaklarıyla birlikte düşürülür.
      const prevArea = pendingAreaCaptureRef.current
      if (prevArea) dropCaptureSource(prevArea.id, prevArea.dataUrl)
      setPendingAreaCapture(null)
      dropOtherPendingCapture()
      setPendingFullPageText({ id: nextCaptureId('text'), text, meta: meta ?? null })
    },
    [dropCaptureSource, dropOtherPendingCapture, setPendingAreaCapture, setPendingFullPageText]
  )

  /**
   * "Taslağa Ekle" — görsellerle aynı sözleşme: kuyruk yalnızca kabul ederse
   * sahiplik devreder; reddedilirse bekleyen metin **korunur** ve kullanıcı
   * elemanlarını azaltıp yeniden deneyebilir (kaybolan içerik yok).
   */
  const confirmPendingFullPageTextAsDraft = useCallback(() => {
    const pending = pendingFullPageTextRef.current
    if (!pending) return false
    const accepted = queueTextForAi(pending.text, null, pending.meta ?? undefined)
    if (!accepted) return false
    setPendingFullPageText(null)
    return true
  }, [queueTextForAi, setPendingFullPageText])

  const dismissPendingFullPageText = useCallback(() => {
    setPendingFullPageText(null)
  }, [setPendingFullPageText])

  const clearScreenshotMeta = useCallback(() => {
    screenshotMetaRef.current = null
  }, [])

  return {
    isScreenshotMode,
    pendingAreaCapture: areaCapture,
    pendingFullPageCapture: fullPageCapture,
    pendingFullPageTextCapture: fullPageTextCapture,
    startScreenshot,
    closeScreenshot,
    handleCapture,
    retainCaptureSource,
    releaseCaptureSource,
    confirmPendingAreaAsDraft,
    dismissPendingArea,
    offerFullPageCapture,
    confirmPendingFullPageAsDraft,
    dismissPendingFullPage,
    offerFullPageText,
    confirmPendingFullPageTextAsDraft,
    dismissPendingFullPageText,
    clearScreenshotMeta
  }
}

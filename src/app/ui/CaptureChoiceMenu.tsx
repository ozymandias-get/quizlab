import type { SelectionMenuFeedback } from '@features/pdf'
import {
  computeSelectionMenuAnchor,
  DEFAULT_SELECTION_MENU_SIZE,
  findLastTextLineRect,
  hasUsableRect,
  PdfSelectionMenu,
  toMenuBounds,
  viewportFallbackAnchor
} from '@features/pdf'

import { buildImageSourceHeader } from '@app/providers/ai/pdfSource'
import { blobUrlToDataUrl } from '@app/providers/app-tool/appToolUtils'
import { useAppToolActions, useAppToolScreenshotState } from '@app/providers/AppToolContext'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Yakalama sonrası ikili menü — alan görseli ve tam sayfa görseli için aynı
 * s��zleşme: `AI'ye Gönder | Taslağa Ekle`.
 *
 * - Görsel önizleme galerisi yok; kompakt menü yakalamanın yakınında belirir.
 * - Alan yakalaması: kırpma rect'i gerçek ekran koordinatıdır.
 * - Tam sayfa yakalaması: sayfanın son metin satırının gerçek DOM rect'i.
 * - Konum bulunamazsa sabit bir köşe noktası değil, **ölçülen viewport'tan
 *   türetilmiş** bir yer kullanılır (bkz. `viewportFallbackAnchor`).
 * - Taslağa Ekle hiçbir gönderim tetiklemez; global autoSend'e dokunmaz ve
 *   kuyruğun sonucunu **kontrol eder**: reddedildiyse "eklendi" gösterilmez.
 * - Doğrudan gönderim taslağı tüketmez/silmez; hazırlanan (staged) sonuç
 *   "Gönderildi" diye raporlanmaz.
 * - Yeni bir yakalama eski bekleyeni geçersiz kılar; iptal edilen yakalama
 *   yeni işlemin üzerine yazılmaz (state bu katmanda tek sahipli).
 * - Menü, metin seçim menüsünden **ayrı bir DOM yüzeyidir** ve kendi ref'i
 *   üzerinden dış-tıklama kontrolü yapar. Aynı `data-testid` iki yüzeyde de
 *   bulunduğunda `document.querySelector` ilk eşleşmeyi getirir ve iki menü
 *   birbirinin tıklamasını tüketebilirdi.
 *
 * ## Kaynak yaşam döngüsü (blob)
 *
 * Tam sayfa yakalamasının bazı yolları `blob:` URL'i döndürür (canvas'ın
 * `toDataURL`'ı çağrılamadığı durumlar). Gönderim hattı ise yalnızca
 * `data:image/` bekler. Bu yüzden dönüşüm **gönderimden hemen önce, tek bir
 * yerde** yapılır; kaynak dönüşüm bitmeden iptal edilmez, dönüşümden sonra
 * da normal akışta (kabul / vazgeçme) serbest bırakılır.
 *
 * ## Gönderim sürerken kapatma
 *
 * Escape ve dış-tıklama `dismiss`'i çağırır. Gönderim asenkron sürerken
 * `dismiss` kaynağı **iptal edemez** (blob URL erken iptal edilirse gönderim
 * boş kaynakla karşılaşır); bu yüzden yalnızca görünümü kapatır. Kaynak,
 * gönderim bittiğinde kabul edilirse normal yoldan serbest bırakılır.
 */
function CaptureChoiceMenu() {
  const { pendingAreaCapture, pendingFullPageCapture } = useAppToolScreenshotState()
  const {
    confirmPendingAreaAsDraft,
    dismissPendingArea,
    confirmPendingFullPageAsDraft,
    dismissPendingFullPage,
    sendImageDirectToAi
  } = useAppToolActions()
  const [feedback, setFeedback] = useState<SelectionMenuFeedback>('idle')
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Bu menünün kendi yüzeyi — dış-tıklama ve "menünün içi" kontrolü için. */
  const surfaceRef = useRef<HTMLDivElement>(null)
  const pendingAreaRef = useRef(pendingAreaCapture)
  pendingAreaRef.current = pendingAreaCapture
  const pendingFullPageRef = useRef(pendingFullPageCapture)
  pendingFullPageRef.current = pendingFullPageCapture

  /**
   * Aktif yakalamanın kimliği: `area:<url>` | `full:<url>` | null.
   *
   * Hem menüyü konumlandırır hem de "hangi yakalama üzerinde işlem yapıyoruz"
   * sorusunun tek ve deterministik yanıtını verir — alan ve tam sayfa aynı
   * anda bekleyemez (bkz. `useScreenshotPipeline`), ama yine de karar tek bir
   * anahtardan okunur.
   */
  const pendingKey = pendingAreaCapture
    ? `area:${pendingAreaCapture.dataUrl}`
    : pendingFullPageCapture
      ? `full:${pendingFullPageCapture.dataUrl}`
      : null

  /**
   * Yeni bir yakalama geldiğinde menü durumu sıfırlanır.
   *
   * Bekleyen yakalamanın **tüketilmesi** (`pendingKey` → null) sıfırlamaz:
   * ekleme artık menüyü doğrudan kapattığı için gösterilecek bir başarı
   * geri bildirimi kalmadı; yalnızca hata durumu sürdürülür.
   */
  const seenPendingKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pendingKey) {
      seenPendingKeyRef.current = null
      return
    }
    if (seenPendingKeyRef.current === pendingKey) return
    seenPendingKeyRef.current = pendingKey
    setFeedback('idle')
  }, [pendingKey])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  /** Gönderim sürerken menüyü gizler ama kaynağı yaşatır. */
  const [menuHidden, setMenuHidden] = useState(false)
  /** Gönderimde olan yakalama: asenkron sonucun hangi yakalamaya ait olduğu. */
  const sendingRef = useRef<{ key: string } | null>(null)
  useEffect(() => {
    if (!menuHidden) return
    // Gizli menü, ancak gönderim yoksa yeni bir yakalama onu geri getirir.
    if (!sendingRef.current) setMenuHidden(false)
  }, [menuHidden, pendingKey])

  const anchor = useMemo(() => {
    // Alan yakalaması: kırpma rect'i (gerçek ekran koordinatı).
    const cropRect = pendingAreaCapture?.rect
    if (hasUsableRect(cropRect) && cropRect) {
      return computeSelectionMenuAnchor(
        toMenuBounds({
          top: cropRect.top,
          bottom: cropRect.top + cropRect.height,
          left: cropRect.left,
          right: cropRect.left + cropRect.width
        }),
        null,
        DEFAULT_SELECTION_MENU_SIZE
      )
    }
    // Tam sayfa yakalaması: seçim anındaki sayfanın son metin satırı.
    if (pendingFullPageCapture) {
      const page = pendingFullPageCapture.meta?.source?.page ?? pendingFullPageCapture.meta?.page
      const lineRect = page ? findLastTextLineRect(page) : null
      if (hasUsableRect(lineRect) && lineRect) {
        return computeSelectionMenuAnchor(toMenuBounds(lineRect), null, DEFAULT_SELECTION_MENU_SIZE)
      }
      const pageEl =
        page != null ? document.querySelector(`[data-native-pdf-page="${page}"]`) : null
      const pageRect = pageEl?.getBoundingClientRect() ?? null
      if (hasUsableRect(pageRect) && pageRect) {
        return computeSelectionMenuAnchor(toMenuBounds(pageRect), null, DEFAULT_SELECTION_MENU_SIZE)
      }
    }
    // Gerçek bir hedef yok: menüyü ekranın sol üst köşesine yapıştıran sabit
    // bir nokta yerine, ölçülen viewport'tan türetilen makul bir konuma düş.
    return viewportFallbackAnchor(DEFAULT_SELECTION_MENU_SIZE)
  }, [pendingAreaCapture, pendingFullPageCapture])

  const showFeedbackFor = useCallback((next: SelectionMenuFeedback, afterMs: number) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    setFeedback(next)
    feedbackTimerRef.current = setTimeout(() => {
      feedbackTimerRef.current = null
      setFeedback('idle')
    }, afterMs)
  }, [])

  /**
   * "Taslağa Ekle" — kuyruğun gerçek sonucunu kontrol eder.
   *
   * `confirmPending*AsDraft` yalnızca kuyruk kabul ederse `true` döner ve
   * sahipliği devreder. Reddedildiğinde bekleyen yakalama **korunur**: menü
   * `error` durumuna geçer, kaynak kaybolmaz ve kullanıcı öğelerini azaltıp
   * yeniden deneyebilir. Kabul edildiğinde ise menü **sessizce** kapanır —
   * görsel taslakta görünür olduğu için "eklendi" yazısı gereksizdir.
   */
  const handleAddToDraft = useCallback(() => {
    if (feedback === 'working') return
    const accepted = pendingAreaRef.current
      ? confirmPendingAreaAsDraft()
      : pendingFullPageRef.current
        ? confirmPendingFullPageAsDraft()
        : false
    if (!accepted) {
      showFeedbackFor('error', 1800)
      return
    }
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = null
    setFeedback('idle')
    setMenuHidden(false)
    if (pendingAreaRef.current) dismissPendingArea()
    else dismissPendingFullPage()
  }, [
    confirmPendingAreaAsDraft,
    confirmPendingFullPageAsDraft,
    dismissPendingArea,
    dismissPendingFullPage,
    feedback,
    showFeedbackFor
  ])

  /**
   * Gönderim girdisinin beklediği formata getirir.
   *
   * Tam sayfa yakalamasının fallback yolları `blob:` URL'i üretebilir; API
   * Chat ve görsel pipeline'ları ise yalnızca `data:image/` kabul eder.
   * Dönüşüm **tek yerde**, gönderimden hemen önce yapılır — görsel sessizce
   * kaybolmaz, dönüşüm hatası kullanıcıya gerçek bir hata olarak döner.
   */
  const toSendableDataUrl = useCallback(async (source: string) => {
    if (!source.startsWith('blob:')) return source
    return blobUrlToDataUrl(source)
  }, [])

  const handleSendDirect = useCallback(async () => {
    const area = pendingAreaRef.current
    const fullPage = pendingFullPageRef.current
    const source = area?.dataUrl ?? fullPage?.dataUrl
    const meta = area?.meta ?? fullPage?.meta ?? null
    const runKey = area ? `area:${area.dataUrl}` : fullPage ? `full:${fullPage.dataUrl}` : null
    if (!source || !runKey || feedback === 'working') return
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    setFeedback('working')
    sendingRef.current = { key: runKey }
    try {
      // Kaynak dönüşüm bitmeden iptal edilmez: `blobUrlToDataUrl` aynı URL'i
      // okuyor, erken bir revoke burada hatayı tetiklerdi.
      const dataUrl = await toSendableDataUrl(source)
      const header = buildImageSourceHeader(meta?.source ?? null)
      const result = await sendImageDirectToAi(dataUrl, header ? { promptText: header } : {})
      // Bu koşuda menü zaten kapanmış ya da başka bir yakalama gelmiş olabilir;
      // eski bir sonuç yeni yakalamanın durumunu değiştirmemeli.
      if (sendingRef.current?.key !== runKey) return
      if (result && (result as { success?: boolean }).success) {
        // Kaynak artık gerekmiyor: normal kabul yolundan serbest bırakılır.
        if (area) dismissPendingArea()
        else dismissPendingFullPage()
        setFeedback('idle')
      } else {
        // Hata: menü geri gelir, kullanıcı tekrar deneyebilir veya vazgeçebilir.
        showFeedbackFor('error', 2400)
      }
    } catch {
      if (sendingRef.current?.key !== runKey) return
      showFeedbackFor('error', 2400)
    } finally {
      if (sendingRef.current?.key === runKey) sendingRef.current = null
    }
  }, [
    dismissPendingArea,
    dismissPendingFullPage,
    feedback,
    sendImageDirectToAi,
    showFeedbackFor,
    toSendableDataUrl
  ])

  /**
   * Kullanıcının kapatma eylemi.
   *
   * Gönderim sürerken bu yalnızca **görünümü** kapatır: kaynak, işlem bitmeden
   * serbest bırakılamaz. `dismissPending*` yalnızca gönderim bittiğinde
   * (kabul edildi) veya gönderim yokken çağrılır.
   */
  const dismiss = useCallback(() => {
    if (sendingRef.current) {
      setMenuHidden(true)
      return
    }
    if (pendingAreaRef.current) dismissPendingArea()
    else dismissPendingFullPage()
  }, [dismissPendingArea, dismissPendingFullPage])

  const hasPending = (!!pendingAreaCapture || !!pendingFullPageCapture) && !menuHidden

  useEffect(() => {
    if (!hasPending) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      // Kendi yüzeyimiz üzerinden kontrol: `data-testid` sorgusu iki menü
      // (metin seçim menüsü + bu menü) aynı anda açıkken yanlış yüzeyi
      // bulur ve birinin tıklaması diğerini tüketirdi.
      const surface = surfaceRef.current
      if (surface && target && surface.contains(target)) return
      dismiss()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [hasPending, dismiss])

  if ((!pendingAreaCapture && !pendingFullPageCapture) || typeof document === 'undefined')
    return null
  // Gönderim sürerken kullanıcı menüyü kapattıysa kaynak yaşamaya devam
  // eder, yalnızca menü çizilmez.
  if (!hasPending) return null

  return createPortal(
    <div ref={surfaceRef}>
      <PdfSelectionMenu
        top={anchor.top}
        left={anchor.left}
        feedback={feedback}
        onSendToAi={handleSendDirect}
        onAddToDraft={handleAddToDraft}
      />
    </div>,
    document.body
  )
}

export default memo(CaptureChoiceMenu)

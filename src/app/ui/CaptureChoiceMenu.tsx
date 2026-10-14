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
 * sözleşme: `AI'ye Gönder | Taslağa Ekle`.
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
 * ## Yakalama kimliği = kaynak değil
 *
 * Menü, "hangi yakalama üzerinde işlem yapıyoruz?" sorusunu `pendingKey` ile
 * yanıtlar. Bu anahtar **kaynak URL metninden değil**, `useScreenshotPipeline`'ın
 * ürettiği benzersiz yakalama `id`si türetilir.
 *
 * Kaynak metni kimlik olarak kullanılamaz: iki yakalama da aynı `data:` URL'ini
 * verebilir. Böyle bir çakışmada ilk gönderimin tamamlanması ikinci yakalamanın
 * menüsünü kapatır ve kaynağını siler — kullanıcının yeni yakalaması, eski bir
 * işlemin geç kalıntısı olarak yok olur.
 *
 * Bu yüzden **her asenkron sonuç yalnızca kendi yakalamasına dokunur**:
 * menü kapatma, kaynak serbest bırakma ve geri bildirim değişikliği
 * `sendingRef`'in tuttuğu `captureId` ile doğrulanır. Yeni bir yakalama,
 * önceki gönderimin tamamlanmasından **etkilenmez**.
 *
 * ## Kaynak yaşam döngüsü (blob)
 *
 * Tam sayfa yakalamasının bazı yolları `blob:` URL'i döndürür (canvas'ın
 * `toDataURL`'ı çağrılamadığı durumlar). Gönderim hattı ise yalnızca
 * `data:image/` bekler. Bu yüzden dönüşüm **gönderimden hemen önce, tek bir
 * yerde** yapılır; kaynak dönüşüm bitmeden iptal edilmez, dönüşümden sonra
 * da normal akışta (kabul / vazgeçme) serbest bırakılır.
 *
 * Gönderim başlarken `retainCaptureSource` ile kaynak **tutulur**: bu
 * andan itibaren kaynağın sahipliği yakalama hattında değil, süren
 * gönderimdedir ve yeni bir yakalama onu düşürse bile iptal edilmez. İşlem
 * biter bitmez `releaseCaptureSource` çağrılır; ertelenmiş bir iptal varsa
 * **o anda** yapılır. Böylece ne kaynak erken ölür ne de hiç kullanılmadan
 * sızıntılanır.
 *
 * ## Gönderim sürerken kapatma
 *
 * Escape ve dış-tıklama `dismiss`'i çağırır. Gönderim asenkron sürerken
 * `dismiss` kaynağı **iptal edemez** (blob URL erken iptal edilirse gönderim
 * boş kaynakla karşılaşır); bu yüzden yalnızca **o yakalamanın** görünümünü
 * gizler. Gizleme bir boolean değil, **hangi yakalama** bilgisidir: yeni bir
 * yakalama geldiğinde gizleme ona uygulanmaz, eski gizlemeden etkilenmez.
 *
 * Ref tek başına re-render tetiklemez. Bu yüzden süren gönderim hem senkron
 * bir kilit (`sendingRef`) hem de **reaktif** bir state (`sendingCaptureId`)
 * olarak tutulur: kilit aynı olaydaki ikinci tıklamayı, state ise gizli menünün
 * "gönderim bitti mi?" sorusunu yanıtlayan effect'i besler.
 */
function CaptureChoiceMenu() {
  const { pendingAreaCapture, pendingFullPageCapture } = useAppToolScreenshotState()
  const {
    confirmPendingAreaAsDraft,
    dismissPendingArea,
    retainCaptureSource,
    releaseCaptureSource,
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
   * Aktif yakalamanın kimliği: `area:<n>` | `full:<n>` | null.
   *
   * Hem menüyü konumlandırır hem de "hangi yakalama üzerinde işlem yapıyoruz"
   * sorusunun tek ve deterministik yanıtını verir — alan ve tam sayfa aynı
   * anda bekleyemez (bkz. `useScreenshotPipeline`), ama yine de karar tek bir
   * anahtardan okunur. Anahtar **kaynak URL değil**, yakalamanın `id`si
   * türetilir: iki yakalamanın aynı `data:` URL'ini taşıması bu iki işlemi
   * birbirine karıştırmaz.
   *
   * `id` zaten `area:<n>` / `full:<n>` biçimindedir (`nextCaptureId`), bu yüzden
   * burada **yeniden ön eklenmez**: `setHiddenCaptureId(pendingKey)` ile
   * saklanan değer, tamamlanan yakalamanın `captureId`si ile aynı olmalıdır.
   * Aksi halde "gizlediğim yakalamayı geri göster" karşılaştırmaları hiç
   * eşleşmez ve yakalama kalıcı olarak gizli kalır.
   */
  const pendingKey = pendingAreaCapture
    ? pendingAreaCapture.id
    : pendingFullPageCapture
      ? pendingFullPageCapture.id
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

  /**
   * Gizlenen menü **hangi yakalama** için gizlendi?
   *
   * Boolean yerine kimlik tutulur: A'nın gönderimi sürerken B yakalanırsa
   * `hiddenCaptureId` A'ya ait kalır ve `pendingKey` artık B olduğu için B'nin
   * menüsü **açık** görünür. Gizleme yeni yakalamaya sızmaz.
   */
  const [hiddenCaptureId, setHiddenCaptureId] = useState<string | null>(null)
  /**
   * Gönderimde olan yakalama.
   *
   * `sendingRef` **senkron** kilittir (aynı olaydaki ikinci tıklamayı
   * yakalar), `sendingCaptureId` ise aynı bilginin **reaktif** kopyasıdır:
   * `ref` değişikliği tek başına render/effect tetiklemez, bu yüzden "gönderim
   * bitti mi?" sorusu bir ref'e değil, state'e sorulur.
   */
  const sendingRef = useRef<string | null>(null)
  const [sendingCaptureId, setSendingCaptureId] = useState<string | null>(null)
  useEffect(() => {
    if (hiddenCaptureId === null) return
    // Gizli menü, ancak **kendi gönderimi** bittiğinde geri gelir. Yeni bir
    // yakalamanın kimliği farklı olduğu için eski gizleme onu etkilemez.
    if (sendingCaptureId === null) setHiddenCaptureId(null)
  }, [hiddenCaptureId, sendingCaptureId])

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
    setHiddenCaptureId(null)
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
    const capture = area ?? fullPage
    const source = capture?.dataUrl
    const meta = area?.meta ?? fullPage?.meta ?? null
    // Koşunun kimliği **kaynak değil, yakalama kimliğidir**. Aynı `data:` URL'ini
    // taşıyan iki yakalama bu sayede ayrı koşu olarak izlenir.
    const captureId = capture?.id ?? null
    if (!source || captureId === null || feedback === 'working') return
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    setFeedback('working')
    // Kaynak bu andan itibaren gönderimin sorumluluğunda: yeni bir yakalama
    // gelip bu yakalamayı düşürse bile kaynak iptal edilmez.
    retainCaptureSource(captureId)
    sendingRef.current = captureId
    setSendingCaptureId(captureId)
    /** Bu koşunun artık geçerli olup olmadığı — tek ve deterministik yanıt. */
    const isCurrentRun = () => sendingRef.current === captureId
    /**
     * Koşu bittiğinde **hangi** yakalamanın hâlâ beklediği.
     *
     * Ref yalnızca render'da güncellendiği için değer, gönderim bitene kadarki
     * son durumu verir. Araya giren B, A'dan farklı bir kimlik taşıdığı için
     * karşılaştırma A'yı geçersiz kılar — A'nın sonucu B'ye uygulanmaz.
     */
    const stillPending = () => {
      const current = pendingAreaRef.current?.id ?? pendingFullPageRef.current?.id ?? null
      return current === captureId
    }
    try {
      // Kaynak dönüşüm bitmeden iptal edilmez: `blobUrlToDataUrl` aynı URL'i
      // okuyor, erken bir revoke burada hatayı tetiklerdi.
      const dataUrl = await toSendableDataUrl(source)
      const header = buildImageSourceHeader(meta?.source ?? null)
      const result = await sendImageDirectToAi(dataUrl, header ? { promptText: header } : {})
      if (!isCurrentRun()) return
      // Kaynağın gönderim üzerindeki müsahadeti biter: ertelenmiş bir iptal
      // varsa burada ve şimdi yapılır (yoksa kaynak sızar).
      releaseCaptureSource(captureId)
      const ours = stillPending()
      if (result && (result as { success?: boolean }).success) {
        if (ours) {
          // Kaynak artık gerekmiyor: yalnızca **hâlâ bizimki olan** yakalama
          // normal kabul yolundan serbest bırakılır.
          if (area) dismissPendingArea()
          else dismissPendingFullPage()
          setHiddenCaptureId((hidden) => (hidden === captureId ? null : hidden))
          setFeedback('idle')
        }
        // Başka bir yakalama bekliyorsa menüsüne, konumuna ya da geri
        // bildirimine **hiç dokunulmaz**.
      } else if (ours) {
        // Hata: menü geri gelir, kullanıcı tekrar deneyebilir veya vazgeçebilir.
        // Otomatik tekrar **yok**: belirsiz bir teslimde aynı içeriği ikinci kez
        // göndermek hedefte ikinci bir kopya bırakır.
        setHiddenCaptureId((hidden) => (hidden === captureId ? null : hidden))
        showFeedbackFor('error', 2400)
      }
    } catch {
      if (!isCurrentRun()) return
      releaseCaptureSource(captureId)
      if (!stillPending()) return
      setHiddenCaptureId((hidden) => (hidden === captureId ? null : hidden))
      showFeedbackFor('error', 2400)
    } finally {
      if (isCurrentRun()) {
        sendingRef.current = null
        // Ref değişikliği tek başına render üretmez; efektin "gönderim bitti
        // mi?" sorusunu sorabilmesi için aynı bilgi state'e de yazılır.
        setSendingCaptureId(null)
      }
    }
  }, [
    dismissPendingArea,
    dismissPendingFullPage,
    feedback,
    releaseCaptureSource,
    retainCaptureSource,
    sendImageDirectToAi,
    showFeedbackFor,
    toSendableDataUrl
  ])

  /**
   * Kullanıcının kapatma eylemi.
   *
   * Gönderim sürerken bu yalnızca **görünümü** kapatır: kaynak, işlem bitmeden
   * serbest bırakılamaz (gönderim onu okuyor). `dismissPending*` yalnızca
   * gönderim bittiğinde (kabul edildi) veya gönderim yokken çağrılır.
   */
  const dismiss = useCallback(() => {
    if (sendingRef.current) {
      // Gizleme kimliğe bağlıdır: yeni bir yakalama bu gizlemeyi devralmaz.
      setHiddenCaptureId(pendingKey)
      return
    }
    if (pendingAreaRef.current) dismissPendingArea()
    else dismissPendingFullPage()
  }, [dismissPendingArea, dismissPendingFullPage, pendingKey])

  const hasPending =
    (!!pendingAreaCapture || !!pendingFullPageCapture) && hiddenCaptureId !== pendingKey

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

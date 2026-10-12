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
import {
  useAppToolActions,
  useAppToolQueueState,
  useAppToolScreenshotState
} from '@app/providers/AppToolContext'

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
  const { pendingAiItems } = useAppToolQueueState()
  const [feedback, setFeedback] = useState<SelectionMenuFeedback>('idle')
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Bu menünün kendi yüzeyi — dış-tıklama ve "menünün içi" kontrolü için. */
  const surfaceRef = useRef<HTMLDivElement>(null)
  const pendingAreaRef = useRef(pendingAreaCapture)
  pendingAreaRef.current = pendingAreaCapture
  const pendingFullPageRef = useRef(pendingFullPageCapture)
  pendingFullPageRef.current = pendingFullPageCapture

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  // Yeni yakalama geldiğinde feedback sıfırlanır.
  const pendingKey = pendingAreaCapture
    ? `area:${pendingAreaCapture.dataUrl}`
    : pendingFullPageCapture
      ? `full:${pendingFullPageCapture.dataUrl}`
      : null
  useEffect(() => {
    setFeedback('idle')
  }, [pendingKey])

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

  /**
   * "Taslağa Ekle" — kuyruğun gerçek sonucunu kontrol eder.
   *
   * `confirmPending*AsDraft` yalnızca kuyruk kabul ederse `true` döner ve
   * sahipliği devreder. Reddedildiğinde bekleyen yakalama **korunur**: menü
   * "eklendi" göstermez, `error` durumuna geçer ve kaynak kaybolmaz.
   */
  const handleAddToDraft = useCallback(() => {
    if (feedback === 'working') return
    const accepted = pendingAreaRef.current
      ? confirmPendingAreaAsDraft()
      : pendingFullPageRef.current
        ? confirmPendingFullPageAsDraft()
        : false
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    if (!accepted) {
      setFeedback('error')
      feedbackTimerRef.current = setTimeout(() => {
        feedbackTimerRef.current = null
        setFeedback('idle')
      }, 1800)
      return
    }
    setFeedback('added')
    feedbackTimerRef.current = setTimeout(() => {
      feedbackTimerRef.current = null
      setFeedback('idle')
      if (pendingAreaRef.current) dismissPendingArea()
      else dismissPendingFullPage()
    }, 1400)
  }, [
    confirmPendingAreaAsDraft,
    confirmPendingFullPageAsDraft,
    dismissPendingArea,
    dismissPendingFullPage,
    feedback
  ])

  const handleSendDirect = useCallback(async () => {
    const area = pendingAreaRef.current
    const fullPage = pendingFullPageRef.current
    const dataUrl = area?.dataUrl ?? fullPage?.dataUrl
    const source = area?.meta?.source ?? fullPage?.meta?.source ?? null
    if (!dataUrl || feedback === 'working') return
    setFeedback('working')
    try {
      const header = buildImageSourceHeader(source)
      const result = await sendImageDirectToAi(dataUrl, header ? { promptText: header } : {})
      if (result && (result as { success?: boolean }).success) {
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        if (area) dismissPendingArea()
        else dismissPendingFullPage()
        setFeedback('idle')
      } else {
        // Hata: menü açık kalır, kullanıcı tekrar deneyebilir.
        setFeedback('idle')
      }
    } catch {
      setFeedback('idle')
    }
  }, [dismissPendingArea, dismissPendingFullPage, feedback, sendImageDirectToAi])

  const dismiss = useCallback(() => {
    if (pendingAreaRef.current) dismissPendingArea()
    else dismissPendingFullPage()
  }, [dismissPendingArea, dismissPendingFullPage])

  const hasPending = !!pendingAreaCapture || !!pendingFullPageCapture

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

  if (!hasPending || typeof document === 'undefined') return null

  return createPortal(
    <div ref={surfaceRef}>
      <PdfSelectionMenu
        top={anchor.top}
        left={anchor.left}
        feedback={feedback}
        // Kuyruğa ekleme senkron uygulandığı için sayaç zaten güncel; ek "+1"
        // gerçekte olmayan ikinci bir öğe sayardı.
        addedCount={pendingAiItems.length}
        onSendToAi={handleSendDirect}
        onAddToDraft={handleAddToDraft}
      />
    </div>,
    document.body
  )
}

export default memo(CaptureChoiceMenu)

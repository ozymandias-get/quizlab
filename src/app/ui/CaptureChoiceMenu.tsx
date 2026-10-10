import type { SelectionMenuFeedback } from '@features/pdf'
import { computeSelectionMenuAnchor, findLastTextLineRect, PdfSelectionMenu } from '@features/pdf'

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
 * - Taslağa Ekle hiçbir gönderim tetiklemez; global autoSend'e dokunmaz.
 * - Doğrudan gönderim taslağı tüketmez/silmez; hazırlanan (staged) sonuç
 *   "Gönderildi" diye raporlanmaz.
 * - Yeni bir yakalama eski bekleyeni geçersiz kılar; iptal edilen yakalama
 *   yeni işlemin üzerine yazılmaz (state bu katmanda tek sahipli).
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
    if (pendingAreaCapture?.rect) {
      const rect = pendingAreaCapture.rect
      try {
        return computeSelectionMenuAnchor({
          top: rect.top,
          bottom: rect.top + rect.height,
          left: rect.left,
          right: rect.left + rect.width
        })
      } catch {
        return { top: rect.top + rect.height + 8, left: rect.left }
      }
    }
    // Tam sayfa yakalaması: seçim anındaki sayfanın son metin satırı.
    if (pendingFullPageCapture) {
      const page = pendingFullPageCapture.meta?.source?.page ?? pendingFullPageCapture.meta?.page
      const lineRect = page ? findLastTextLineRect(page) : null
      if (lineRect) {
        try {
          return computeSelectionMenuAnchor({
            top: lineRect.top,
            bottom: lineRect.bottom,
            left: lineRect.left,
            right: lineRect.right
          })
        } catch {
          return { top: lineRect.bottom + 8, left: lineRect.left }
        }
      }
      const pageEl =
        page != null ? document.querySelector(`[data-native-pdf-page="${page}"]`) : null
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect()
        return computeSelectionMenuAnchor({
          top: pageRect.top,
          bottom: pageRect.bottom,
          left: pageRect.left,
          right: pageRect.right
        })
      }
      return { top: 120, left: 120 }
    }
    return { top: 120, left: 120 }
  }, [pendingAreaCapture, pendingFullPageCapture])

  const handleAddToDraft = useCallback(() => {
    if (feedback === 'working') return
    if (pendingAreaRef.current) {
      confirmPendingAreaAsDraft()
    } else if (pendingFullPageRef.current) {
      confirmPendingFullPageAsDraft()
    } else {
      return
    }
    setFeedback('added')
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => {
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
      const menuEl = document.querySelector('[data-testid="pdf-selection-menu"]')
      if (menuEl && target && menuEl.contains(target)) return
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
    <PdfSelectionMenu
      top={anchor.top}
      left={anchor.left}
      feedback={feedback}
      // Kuyruğa ekleme senkron uygulandığı için sayaç zaten güncel; ek "+1"
      // gerçekte olmayan ikinci bir öğe sayardı.
      addedCount={pendingAiItems.length}
      onSendToAi={handleSendDirect}
      onAddToDraft={handleAddToDraft}
    />,
    document.body
  )
}

export default memo(CaptureChoiceMenu)

import type { SelectionMenuFeedback } from '@features/pdf'
import { computeSelectionMenuAnchor, PdfSelectionMenu } from '@features/pdf'

import { buildImageSourceHeader } from '@app/providers/ai/pdfSource'
import {
  useAppToolActions,
  useAppToolQueueState,
  useAppToolScreenshotState
} from '@app/providers/AppToolContext'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Alan yakalama sonrası ikili menü: aynı iki seçenek (AI'ye Gönder / Taslağa Ekle).
 *
 * - Görsel önizleme galerisi yok; kompakt menü seçilen alanın yakınında belirir.
 * - Görsel kullanıcıya büyük panelde tekrar gösterilmez.
 * - Taslağa Ekle hiçbir gönderim tetiklemez; global autoSend'e dokunmaz.
 * - Doğrudan gönderim taslağı tüketmez/silmez.
 */
function AreaImageChoiceMenu() {
  const { pendingAreaCapture } = useAppToolScreenshotState()
  const { confirmPendingAreaAsDraft, dismissPendingArea, sendImageDirectToAi } = useAppToolActions()
  const { pendingAiItems } = useAppToolQueueState()
  const [feedback, setFeedback] = useState<SelectionMenuFeedback>('idle')
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef(pendingAreaCapture)
  pendingRef.current = pendingAreaCapture

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  // Yeni yakalama geldiğinde feedback sıfırlanır.
  useEffect(() => {
    setFeedback('idle')
  }, [pendingAreaCapture?.dataUrl])

  const anchor = useMemo(() => {
    const rect = pendingAreaCapture?.rect
    if (!rect) return { top: 120, left: 120 }
    try {
      return computeSelectionMenuAnchor(
        {
          top: rect.top,
          bottom: rect.top + rect.height,
          left: rect.left,
          right: rect.left + rect.width
        },
        null
      )
    } catch {
      return { top: rect.top + rect.height + 8, left: rect.left }
    }
  }, [pendingAreaCapture])

  const handleAddToDraft = useCallback(() => {
    if (!pendingRef.current || feedback === 'working') return
    confirmPendingAreaAsDraft()
    setFeedback('added')
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback('idle')
      dismissPendingArea()
    }, 1400)
  }, [confirmPendingAreaAsDraft, dismissPendingArea, feedback])

  const handleSendDirect = useCallback(async () => {
    const pending = pendingRef.current
    if (!pending || feedback === 'working') return
    setFeedback('working')
    try {
      const header = buildImageSourceHeader(pending.meta?.source ?? null)
      const result = await sendImageDirectToAi(
        pending.dataUrl,
        header ? { promptText: header } : {}
      )
      if (result && (result as { success?: boolean }).success) {
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        dismissPendingArea()
        setFeedback('idle')
      } else {
        setFeedback('idle')
      }
    } catch {
      setFeedback('idle')
    }
  }, [dismissPendingArea, feedback, sendImageDirectToAi])

  useEffect(() => {
    if (!pendingAreaCapture) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissPendingArea()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      const menuEl = document.querySelector('[data-testid="pdf-selection-menu"]')
      if (menuEl && target && menuEl.contains(target)) return
      dismissPendingArea()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [pendingAreaCapture, dismissPendingArea])

  if (!pendingAreaCapture || typeof document === 'undefined') return null

  return createPortal(
    <PdfSelectionMenu
      top={anchor.top}
      left={anchor.left}
      feedback={feedback}
      addedCount={pendingAiItems.length + (feedback === 'added' ? 1 : 0)}
      onSendToAi={handleSendDirect}
      onAddToDraft={handleAddToDraft}
    />,
    document.body
  )
}

export default memo(AreaImageChoiceMenu)

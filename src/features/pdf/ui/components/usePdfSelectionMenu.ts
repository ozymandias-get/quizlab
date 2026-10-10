import { buildPdfDocId, buildPdfSourceMeta, type PdfSourceMeta } from '@app/providers/ai/pdfSource'
import { decorateTextWithSource } from '@app/providers/ai/pdfSource'
import type { SelectionPosition } from '@app/providers/ai/types'
import { useAppToolActions, useAppToolQueueState } from '@app/providers/AppToolContext'

import { useCallback, useEffect, useRef, useState } from 'react'

import { computeSelectionMenuAnchor, resolveSelectionPageRange } from '../../text/selectionPage'
import type { SelectionMenuFeedback } from './PdfSelectionMenu'

export interface TextSelectionSnapshot {
  text: string
  position: SelectionPosition
  source: PdfSourceMeta | null
  requestId: number
}

interface UsePdfSelectionMenuOptions {
  containerRef: React.RefObject<HTMLElement | null>
  pdfFile: {
    path?: string | null
    name?: string | null
    streamUrl?: string | null
    size?: number | null
  } | null
  currentPage: number
  totalPages: number
  onTextSelection?: (text: string, position: SelectionPosition | null) => void
}

export function usePdfSelectionMenu({
  containerRef,
  pdfFile,
  currentPage,
  totalPages,
  onTextSelection
}: UsePdfSelectionMenuOptions) {
  const { queueTextForAi, sendTextDirectToAi } = useAppToolActions()
  const { pendingAiItems } = useAppToolQueueState()
  const [menu, setMenu] = useState<TextSelectionSnapshot | null>(null)
  const [feedback, setFeedback] = useState<SelectionMenuFeedback>('idle')
  const requestIdRef = useRef(0)
  const menuRef = useRef<TextSelectionSnapshot | null>(null)
  menuRef.current = menu
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCountRef = useRef(pendingAiItems.length)
  pendingCountRef.current = pendingAiItems.length
  const onTextSelectionRef = useRef(onTextSelection)
  onTextSelectionRef.current = onTextSelection

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
  }, [])

  useEffect(() => clearFeedbackTimer, [clearFeedbackTimer])

  const closeMenu = useCallback(() => {
    clearFeedbackTimer()
    setFeedback('idle')
    setMenu(null)
  }, [clearFeedbackTimer])

  const handleSelection = useCallback(
    (text: string, position: SelectionPosition | null) => {
      // Legacy bildirimi koru (testler / dış tüketim).
      onTextSelectionRef.current?.(text, position)

      const normalized = text.trim()
      if (!normalized || !position) {
        // Seçim yapılmayan sıradan tıklamada menü görünmesin; mevcut taslak silinmez.
        if (menuRef.current) closeMenu()
        return
      }

      // Aynı içerik/konumda gereksiz yeniden konumlandırma yapma.
      const prev = menuRef.current
      if (
        prev &&
        prev.text === normalized &&
        Math.abs(prev.position.top - position.top) < 1 &&
        Math.abs(prev.position.left - position.left) < 1
      ) {
        return
      }

      let range: { page: number; pageEnd?: number } | null = null
      try {
        range = resolveSelectionPageRange(
          typeof window !== 'undefined' ? window.getSelection() : null,
          currentPage
        )
      } catch {
        range = { page: currentPage }
      }
      const page = range?.page ?? currentPage
      const source: PdfSourceMeta | null = buildPdfSourceMeta({
        file: pdfFile
          ? {
              path: pdfFile.path,
              streamUrl: pdfFile.streamUrl,
              name: pdfFile.name,
              size: pdfFile.size
            }
          : null,
        page,
        pageEnd: range?.pageEnd,
        totalPages: totalPages >= 1 ? totalPages : undefined,
        captureKind: 'text-selection'
      })

      // Fare yönü / çok satır farkları: extractSelectedText bitiş rect'inden
      // konum üretir; burada yalnızca PDF sınırlarına göre son bir kelepçe
      // uygulanır (yeniden hesaplama yok).
      let anchor = { top: position.top, left: position.left }
      try {
        const containerRect = containerRef.current?.getBoundingClientRect() ?? null
        // position zaten kelepçeli; container dışına taşmayı son kez düzelt.
        anchor = computeSelectionMenuAnchor(
          {
            top: position.top - 52,
            bottom: position.top - 8,
            left: position.left - 120,
            right: position.left + 120
          },
          containerRect
            ? {
                top: containerRect.top,
                bottom: containerRect.bottom,
                left: containerRect.left,
                right: containerRect.right
              }
            : null
        )
        // computeSelectionMenuAnchor bir bitiş rect'i bekler; elimizdeki
        // position zaten menü konumudur — container taşması yoksa orijinali koru.
        const insideContainer =
          !containerRect ||
          (anchor.top >= containerRect.top &&
            anchor.top <= containerRect.bottom &&
            anchor.left >= containerRect.left &&
            anchor.left <= containerRect.right)
        if (!insideContainer) {
          // fallback: orijinal konum
          anchor = { top: position.top, left: position.left }
        } else if (
          Math.abs(anchor.top - position.top) > 200 ||
          Math.abs(anchor.left - position.left) > 200
        ) {
          anchor = { top: position.top, left: position.left }
        }
      } catch {
        anchor = { top: position.top, left: position.left }
      }

      // DocId tutarlılığı: docId seçim anında sabitlenir.
      void buildPdfDocId

      const requestId = ++requestIdRef.current
      clearFeedbackTimer()
      setFeedback('idle')
      setMenu({
        text: normalized,
        position: { top: anchor.top, left: anchor.left },
        source,
        requestId
      })
    },
    [clearFeedbackTimer, closeMenu, containerRef, currentPage, pdfFile, totalPages]
  )

  const handleAddToDraft = useCallback(() => {
    const snapshot = menuRef.current
    if (!snapshot || feedback === 'working') return
    // Taslağa Ekle hiçbir koşulda gönderim tetiklemez; global autoSend'e dokunmaz.
    queueTextForAi(snapshot.text, snapshot.position, { source: snapshot.source })
    const nextCount = pendingCountRef.current + 1
    setFeedback('added')
    clearFeedbackTimer()
    // Kısa bildirim: "Taslağa eklendi · N içerik". Taslağı zorla açmaz.
    feedbackTimerRef.current = setTimeout(() => {
      closeMenu()
      // Seçimi koru? Menü kapandıktan sonra seçim kalabilir; ancak yeni
      // seçimler menüyü yeniden açar. Snapshot kullanıldığı için boş içerik riski yok.
      try {
        window.getSelection()?.removeAllRanges()
      } catch {
        // best-effort
      }
    }, 1400)
    // addedCount menüye prop olarak geçilir (render anındaki değer).
    void nextCount
  }, [clearFeedbackTimer, closeMenu, feedback, queueTextForAi])

  const handleSendDirect = useCallback(async () => {
    const snapshot = menuRef.current
    if (!snapshot || feedback === 'working') return
    setFeedback('working')
    try {
      // Doğrudan gönderim taslak kuyruğuna eklemez, mevcut taslağı tüketmez/silmez.
      const decorated = decorateTextWithSource(snapshot.text, snapshot.source, 'text')
      const result = await sendTextDirectToAi(decorated, {})
      if (result && (result as { success?: boolean }).success) {
        setFeedback('sent')
        const id = snapshot.requestId
        // Hızlı arka arkaya seçimde eski async yenisini ezmesin.
        setTimeout(() => {
          if (menuRef.current?.requestId === id) closeMenu()
        }, 300)
        try {
          window.getSelection()?.removeAllRanges()
        } catch {
          // best-effort
        }
      } else {
        setFeedback('idle')
      }
    } catch {
      setFeedback('idle')
    }
  }, [closeMenu, feedback, sendTextDirectToAi])

  // Yeni PDF sayfasına geçerken eski menü yanlış yerde kalmasın.
  useEffect(() => {
    if (menuRef.current) closeMenu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage])

  // PDF değiştiğinde eski metadata yanlış dosyaya bağlanmasın.
  const docKey = pdfFile ? `${pdfFile.path}::${pdfFile.streamUrl}::${pdfFile.name}` : 'none'
  useEffect(() => {
    if (menuRef.current) closeMenu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey])

  return {
    menu,
    feedback,
    addedCount: pendingAiItems.length + (feedback === 'added' ? 1 : 0),
    handleSelection,
    handleAddToDraft,
    handleSendDirect,
    closeMenu
  }
}

import type { SelectionPosition } from '@shared-core/types'

import { isStagedSendResult } from '@features/ai'

import { buildPdfSourceMeta, type PdfSourceMeta } from '@app/providers/ai/pdfSource'
import { decorateTextWithSource } from '@app/providers/ai/pdfSource'
import { useAppToolActions, useAppToolQueueState } from '@app/providers/AppToolContext'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  computeSelectionMenuAnchor,
  type MenuAnchor,
  resolveSelectionPageRange
} from '../../text/selectionPage'
import type { SelectionMenuFeedback } from './PdfSelectionMenu'

export interface TextSelectionSnapshot {
  text: string
  position: MenuAnchor
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
  /**
   * Zoom/ölçek belirteci. Değiştiğinde PDF.js metin katmanını yeniden kurar,
   * seçim geometrisi geçersizlenir; menü yanlış yerde kalmaz, kapanır.
   */
  zoomToken?: number | string
  onTextSelection?: (text: string, position: SelectionPosition | null) => void
}

/**
 * İkili seçim menüsünün durum ve konumlandırma akışı.
 *
 * ## Konumlandırma — tek karar
 *
 * Seçim bitişinin gerçek DOM Range geometrisi (`position.endRect`, viewport
 * koordinatları) yakalanır; menü konumu `computeSelectionMenuAnchor` ile
 * **bir kez** hesaplanır — gerçek bitiş rect'i + gerçek menü ölçüsü + PDF
 * paneli/viewport sınırları. Seçim noktasından yapay dikdörtgen üretip ikinci
 * bir tahmin dönüşümü uygulanmaz.
 *
 * Scroll ve resize sırasında menü canlı seçim geometrisinden yeniden
 * hesaplanır (rAF ile, yalnızca konum gerçekten değiştiyse state güncellenir).
 * Sayfa değişimi, belge değişimi veya zoom seçim geometrisini geçersizlediği
 * için menüyü kapatır.
 *
 * ## Koordinat sistemi
 *
 * Tüm değerler viewport (client) koordinatıdır; menü `position: fixed` olarak
 * `document.body`'ye portal'lanır, bu sayede katman ve transform bağlamından
 * etkilenmez.
 */
export function usePdfSelectionMenu({
  containerRef,
  pdfFile,
  currentPage,
  totalPages,
  zoomToken,
  onTextSelection
}: UsePdfSelectionMenuOptions) {
  const { queueTextForAi, sendTextDirectToAi } = useAppToolActions()
  const { pendingAiItems } = useAppToolQueueState()
  const [menu, setMenu] = useState<TextSelectionSnapshot | null>(null)
  const [feedback, setFeedback] = useState<SelectionMenuFeedback>('idle')
  const requestIdRef = useRef(0)
  const menuRef = useRef<TextSelectionSnapshot | null>(null)
  menuRef.current = menu
  const feedbackRef = useRef(feedback)
  feedbackRef.current = feedback
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

  /**
   * Canlı seçimin bitiş rect'i — scroll/resize sırasında menüyü takip ettirmek
   * için. Seçim artık DOM'da yoksa (silinmiş, sayfa yeniden kurulmuş) null.
   */
  const readLiveEndRect = useCallback((): {
    top: number
    bottom: number
    left: number
    right: number
  } | null => {
    try {
      const selection = typeof window !== 'undefined' ? window.getSelection() : null
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
      const range = selection.getRangeAt(0)
      if (!range.commonAncestorContainer?.isConnected) return null
      const container = containerRef.current
      if (container && !container.contains(range.commonAncestorContainer)) return null
      const rects = typeof range.getClientRects === 'function' ? [...range.getClientRects()] : []
      const end = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect()
      if (end.width <= 0 && end.height <= 0) return null
      return { top: end.top, bottom: end.bottom, left: end.left, right: end.right }
    } catch {
      return null
    }
  }, [containerRef])

  const anchorFromEndRect = useCallback(
    (endRect: { top: number; bottom: number; left: number; right: number }): MenuAnchor => {
      const containerRect = containerRef.current?.getBoundingClientRect() ?? null
      return computeSelectionMenuAnchor(
        endRect,
        containerRect
          ? {
              top: containerRect.top,
              bottom: containerRect.bottom,
              left: containerRect.left,
              right: containerRect.right
            }
          : null
      )
    },
    [containerRef]
  )

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

      // Tek konumlandırma kararı: gerçek bitiş rect'i (extractSelectedText'in
      // DOM Range'den ölçtüğü son satır) + PDF paneli sınırları. Yapay dikdörtgen
      // ve ikinci tahmin dönüşü yok.
      const endRect = position.endRect ?? {
        top: position.top,
        bottom: position.top,
        left: position.left,
        right: position.left
      }
      const anchor = anchorFromEndRect(endRect)

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
    [anchorFromEndRect, clearFeedbackTimer, closeMenu, currentPage, pdfFile, totalPages]
  )

  // Scroll/resize: menü canlı seçim geometrisini takip eder (rAF, tek ölçüm).
  // Seçim DOM'dan kalktıysa menü kapanır — yanlış yerde yalnız kalmaz.
  useEffect(() => {
    if (!menu || feedback !== 'idle') return
    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const endRect = readLiveEndRect()
        if (!endRect) {
          closeMenu()
          return
        }
        const next = anchorFromEndRect(endRect)
        setMenu((prev) => {
          if (!prev) return prev
          if (prev.position.top === next.top && prev.position.left === next.left) return prev
          return { ...prev, position: next }
        })
      })
    }
    const container = containerRef.current
    container?.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      container?.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [menu, feedback, readLiveEndRect, anchorFromEndRect, closeMenu, containerRef])

  /**
   * "Taslağa Ekle" — ekleme sonucunu **kontrol ederek** bildirir.
   *
   * Kuyruk reddederse (limit dolu, içerik geçersiz) menü "eklendi" göstermez,
   * `error` durumuna geçer ve **menü açık kalır**: seçim kaybolmaz, içerik
   * kaybolmaz, kullanıcı öğelerini azaltıp aynı tıklamayı yeniden deneyebilir.
   * Sahte bir başarı göstermek, kullanıcının içeriğinin kaybolduğunu sandığı
   * ama kaybolmadığı bir durumu yaratırdı.
   */
  const handleAddToDraft = useCallback(() => {
    const snapshot = menuRef.current
    if (!snapshot || feedback === 'working') return
    // Taslağa Ekle hiçbir koşulda gönderim tetiklemez; global autoSend'e dokunmaz.
    const accepted = queueTextForAi(
      snapshot.text,
      { top: snapshot.position.top, left: snapshot.position.left },
      {
        source: snapshot.source
      }
    )
    clearFeedbackTimer()
    if (!accepted) {
      // Kısa bildirim, sonra menü eylemleriyle kalıcı olarak açık kalır.
      setFeedback('error')
      feedbackTimerRef.current = setTimeout(() => {
        feedbackTimerRef.current = null
        if (menuRef.current) setFeedback('idle')
      }, 1800)
      return
    }
    setFeedback('added')
    // Kısa bildirim: "Taslağa eklendi · N içerik". Taslağı zorla açmaz.
    feedbackTimerRef.current = setTimeout(() => {
      closeMenu()
      // Seçim yalnızca **ekleme gerçekten gerçekleştiğinde** temizlenir; reddedilen
      // eklemede seçili içerik kullanıcının elinde kalır.
      try {
        window.getSelection()?.removeAllRanges()
      } catch {
        // best-effort
      }
    }, 1400)
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
        const staged = isStagedSendResult(result as { success: boolean; mode?: string })
        // Hazırlanan (staged) sonuç "Gönderildi" demek değildir: kullanıcı
        // AI kutusunda hâlâ göndermeyi onaylamalı.
        setFeedback(staged ? 'staged' : 'sent')
        const id = snapshot.requestId
        // Hızlı arka arkaya seçimde eski async yenisini ezmesin.
        feedbackTimerRef.current = setTimeout(
          () => {
            if (menuRef.current?.requestId === id) closeMenu()
          },
          staged ? 1800 : 300
        )
        try {
          window.getSelection()?.removeAllRanges()
        } catch {
          // best-effort
        }
      } else {
        // Hata: menü aniden yok olmaz, eylemler geri gelir.
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

  // Zoom/ölçek değişimi metin katmanını yeniden kurar; seçim geometrisi
  // geçersizdir. Menü takip etmeye çalışmaz, kapanır.
  useEffect(() => {
    if (zoomToken === undefined) return
    if (menuRef.current) closeMenu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomToken])

  // PDF değiştiğinde eski metadata yanlış dosyaya bağlanmasın.
  const docKey = pdfFile ? `${pdfFile.path}::${pdfFile.streamUrl}::${pdfFile.name}` : 'none'
  useEffect(() => {
    if (menuRef.current) closeMenu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey])

  return {
    menu,
    feedback,
    // Kuyruk güncellemesi aynı olayda senkron uygulanır; geri bildirim
    // render'ında zaten dahildir. "+1" eklemek sayacı iki kez saydırıyordu
    // (gerçek Electron'da "2 içerik" derken taslakta 1 öğe vardı).
    addedCount: pendingAiItems.length,
    handleSelection,
    handleAddToDraft,
    handleSendDirect,
    closeMenu
  }
}

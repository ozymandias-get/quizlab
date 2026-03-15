import { useEffect, useCallback, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * PDF içinde metin seçimini izleyen custom hook
 * Seçim yapıldığında konum bilgisiyle birlikte callback çağırır
 * @param {Object} options - Hook options
 * @param {React.RefObject} options.containerRef - PDF container ref
 * @param {Function} options.onTextSelection - Metin seçildiğinde çağrılacak callback
 */
interface UsePdfTextSelectionOptions {
  containerRef: RefObject<HTMLElement | null>
  onTextSelection: (text: string, position: { top: number; left: number } | null) => void
  enabled?: boolean
}

function isNodeInsideContainer(node: Node | null, container: HTMLElement) {
  return !!node && container.contains(node)
}

function doesRectOverlapContainer(rect: DOMRect, container: HTMLElement) {
  const containerRect = container.getBoundingClientRect()
  if (containerRect.width === 0 || containerRect.height === 0) {
    return false
  }

  return !(
    rect.right < containerRect.left ||
    rect.left > containerRect.right ||
    rect.bottom < containerRect.top ||
    rect.top > containerRect.bottom
  )
}

export function usePdfTextSelection({
  containerRef,
  onTextSelection,
  enabled = true
}: UsePdfTextSelectionOptions) {
  // Metin seçimi hesaplama - pozisyon sınır kontrolleri dahil
  const calculateSelectionPosition = useCallback(
    (selection: Selection | null, container: HTMLElement) => {
      const text = selection?.toString().trim()

      // Seçim boşsa veya yoksa
      if (
        !selection ||
        selection.isCollapsed ||
        !text ||
        text.length === 0 ||
        selection.rangeCount === 0
      ) {
        return { text: '', position: null }
      }

      const range = selection.getRangeAt(0)
      const commonAncestorInside = isNodeInsideContainer(range.commonAncestorContainer, container)
      const anchorInside = isNodeInsideContainer(selection.anchorNode, container)
      const focusInside = isNodeInsideContainer(selection.focusNode, container)
      const rect = range.getBoundingClientRect()
      const overlapsContainer = doesRectOverlapContainer(rect, container)

      // Seçim PDF alanı ile çakışıyorsa daha toleranslı davran.
      if (
        !commonAncestorInside &&
        !(anchorInside && focusInside) &&
        !(overlapsContainer && (anchorInside || focusInside))
      ) {
        return null
      }

      if (rect.width === 0 && rect.height === 0) {
        return { text: '', position: null }
      }

      // Buton boyutları
      const btnWidth = 140
      const btnHeight = 44
      const margin = 10
      const bottomBarHeight = 80 // Alt bar yüksekliği (tahmini)

      // Varsayılan pozisyon: seçimin üstünde ortalanmış
      let top = rect.top - btnHeight - margin
      let left = rect.left + rect.width / 2

      // === SINIR KONTROLLERI ===

      // Üst sınır: Buton ekranın üstüne çıkıyorsa, seçimin altına koy
      if (top < margin) {
        top = rect.bottom + margin
      }

      // Alt sınır: Buton ekranın altına veya taskbar'a gizleniyorsa
      if (top + btnHeight > window.innerHeight - bottomBarHeight - margin) {
        const topPosition = rect.top - btnHeight - margin
        if (topPosition >= margin) {
          top = topPosition
        } else {
          top = Math.max(margin, window.innerHeight - bottomBarHeight - btnHeight - margin)
        }
      }

      // Sol sınır: Buton ekranın soluna çıkmasın
      if (left < btnWidth / 2 + margin) {
        left = btnWidth / 2 + margin
      }

      // Sağ sınır: Buton ekranın sağına çıkmasın
      if (left > window.innerWidth - btnWidth / 2 - margin) {
        left = window.innerWidth - btnWidth / 2 - margin
      }

      return { text, position: { top, left } }
    },
    []
  )

  // Callback ref to avoid re-attaching listeners
  const onTextSelectionRef = useRef(onTextSelection)

  useEffect(() => {
    onTextSelectionRef.current = onTextSelection
  }, [onTextSelection])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let frameId: number | null = null
    let pointerStartedInsideContainer = false

    const clearSelectionState = () => {
      const container = containerRef.current
      container?.classList.remove('pdf-selection-active')
      onTextSelectionRef.current?.('', null)
    }

    const scheduleSelectionUpdate = () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }

      frameId = requestAnimationFrame(() => {
        frameId = null

        const selection = window.getSelection()
        const container = containerRef.current
        const onSelection = onTextSelectionRef.current

        if (!onSelection) return

        if (!container) {
          clearSelectionState()
          return
        }

        const result = calculateSelectionPosition(selection, container)

        if (result === null) {
          clearSelectionState()
          return
        }

        container.classList.toggle('pdf-selection-active', !!result.text && !!result.position)
        onSelection(result.text, result.position)
      })
    }

    if (!enabled) {
      clearSelectionState()
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const container = containerRef.current
      pointerStartedInsideContainer =
        !!container && event.target instanceof Node && container.contains(event.target)
    }

    const handlePointerUp = () => {
      const shouldCheckSelection = pointerStartedInsideContainer
      pointerStartedInsideContainer = false
      if (shouldCheckSelection) {
        scheduleSelectionUpdate()
        return
      }

      const selection = window.getSelection()
      const container = containerRef.current
      if (!selection || !container) {
        return
      }

      const result = calculateSelectionPosition(selection, container)
      if (result?.text) {
        scheduleSelectionUpdate()
      }
    }

    const handleSelectionChange = () => {
      if (pointerStartedInsideContainer) {
        return
      }

      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim()

        if (!text || text.length === 0) {
          clearSelectionState()
        }
      }, 24)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointerup', handlePointerUp, true)
    document.addEventListener('keyup', scheduleSelectionUpdate)
    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('keyup', scheduleSelectionUpdate)
      document.removeEventListener('selectionchange', handleSelectionChange)
      if (timeoutId) clearTimeout(timeoutId)
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [containerRef, calculateSelectionPosition, enabled])
}

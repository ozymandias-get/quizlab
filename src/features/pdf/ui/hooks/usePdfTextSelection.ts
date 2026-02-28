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
    containerRef: RefObject<HTMLElement | null>;
    onTextSelection: (text: string, position: { top: number; left: number } | null) => void;
}

export function usePdfTextSelection({ containerRef, onTextSelection }: UsePdfTextSelectionOptions) {
    // Metin seçimi hesaplama - pozisyon sınır kontrolleri dahil
    const calculateSelectionPosition = useCallback((selection: Selection | null, container: HTMLElement) => {
        const text = selection?.toString().trim()

        // Seçim boşsa veya yoksa
        if (!selection || !text || text.length === 0 || selection.rangeCount === 0) {
            return { text: '', position: null }
        }

        // Seçimin PDF container içinde olup olmadığını kontrol et
        const anchorNode = selection.anchorNode
        if (!anchorNode || !container.contains(anchorNode)) {
            // Seçim PDF container dışında - floating button gösterme
            return null
        }

        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()

        // Buton boyutları
        const btnWidth = 140
        const btnHeight = 44
        const margin = 10
        const bottomBarHeight = 80 // Alt bar yüksekliği (tahmini)

        // Varsayılan pozisyon: seçimin üstünde ortalanmış
        let top = rect.top - btnHeight - margin
        let left = rect.left + (rect.width / 2)

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
    }, [])

    // Callback ref to avoid re-attaching listeners
    const onTextSelectionRef = useRef(onTextSelection)

    useEffect(() => {
        onTextSelectionRef.current = onTextSelection
    }, [onTextSelection])

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const handleSelection = () => {
            const selection = window.getSelection()
            const container = containerRef.current
            const onSelection = onTextSelectionRef.current

            if (!onSelection) return

            if (!container) {
                onSelection('', null)
                return
            }

            const result = calculateSelectionPosition(selection, container)

            // null result means selection is outside container or invalid
            if (result === null) return

            onSelection(result.text, result.position)
        }

        // Handle selection clear on click
        const handleClick = () => {
            // Small delay to ensure selection is actually cleared by the browser
            timeoutId = setTimeout(() => {
                const selection = window.getSelection()
                const text = selection?.toString().trim()
                if (!text || text.length === 0) {
                    onTextSelectionRef.current?.('', null)
                }
            }, 10)
        }

        document.addEventListener('mouseup', handleSelection)
        document.addEventListener('keyup', handleSelection)
        document.addEventListener('mousedown', handleClick)

        return () => {
            document.removeEventListener('mouseup', handleSelection)
            document.removeEventListener('keyup', handleSelection)
            document.removeEventListener('mousedown', handleClick)
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [containerRef, calculateSelectionPosition])
}

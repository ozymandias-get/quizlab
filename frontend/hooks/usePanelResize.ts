import { useState, useEffect, useCallback, useRef, RefObject } from 'react'
import { useLocalStorage } from './useLocalStorage'

// Resizer element width in pixels
const RESIZER_WIDTH = 6

interface UsePanelResizeOptions {
    initialWidth?: number;
    minLeft?: number;
    minRight?: number;
    storageKey: string;
    isReversed?: boolean;
}

interface UsePanelResizeReturn {
    leftPanelWidth: number;
    setLeftPanelWidth: React.Dispatch<React.SetStateAction<number>>;
    isResizing: boolean;
    handleMouseDown: (e: React.MouseEvent) => void;
    leftPanelRef: RefObject<HTMLElement | null>;
    resizerRef: RefObject<HTMLElement | null>;
}

/**
 * Panel boyutlandırma işlemlerini yöneten hook
 * 
 * PERFORMANS OPTİMİZASYONU (v2 - Geliştirilmiş):
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 1. Resize sırasında state güncellemesi YOK → React re-render YOK
 * 2. requestAnimationFrame ile 60fps akıcılık garantisi
 * 3. isResizingRef ile gereksiz re-render'lar önleniyor
 * 4. Sadece mouseup'ta final değer state'e yazılır
 * 5. CSS class toggle doğrudan DOM üzerinden yapılır
 * 
 * NEDEN BU YAKLAŞIM?
 * ━━━━━━━━━━━━━━━━━━
 * - mousemove saniyede 60+ kez tetiklenir
 * - Her state güncellemesi React tree'sini re-render eder
 * - Ref + DOM manipülasyonu ile bunu bypass ediyoruz
 * 
 * @example
 * import { STORAGE_KEYS } from '../constants/storageKeys'
 * const { leftPanelWidth } = usePanelResize({ storageKey: STORAGE_KEYS.LEFT_PANEL_WIDTH })
 */
export function usePanelResize({
    initialWidth = 50,
    minLeft = 300,
    minRight = 400,
    storageKey, // Zorunlu - STORAGE_KEYS'den geçirilmeli
    isReversed = false // Panel sağa yaslı ise true olmalı
}: UsePanelResizeOptions): UsePanelResizeReturn {
    // Final genişlik değeri (localStorage ile senkronize)
    const [leftPanelWidth, setLeftPanelWidth] = useLocalStorage<number>(storageKey, initialWidth)

    // isResizing STATE - sadece component mount/unmount için
    // Aslında resize sırasında REF kullanıyoruz, state sadece dışarıya expose için
    const [isResizing, setIsResizing] = useState<boolean>(false)

    // DOM elementi ref'leri - resize sırasında doğrudan manipülasyon için
    const leftPanelRef = useRef<HTMLElement | null>(null)
    const resizerRef = useRef<HTMLElement | null>(null)

    // Geçici genişlik değeri (resize sırasında state güncellemeden saklamak için)
    const pendingWidthRef = useRef<number>(leftPanelWidth)

    // Resize durumu REF olarak - state güncellemeden takip için
    const isResizingRef = useRef<boolean>(false)

    // requestAnimationFrame ID'si - cleanup için
    const rafIdRef = useRef<number | null>(null)

    // Mouse down - resize başlat
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()

        // REF'i güncelle (re-render YOK)
        isResizingRef.current = true

        // STATE'i güncelle (sadece 1 kez, başlangıçta)
        // Bu, isResizing prop'unu kullanan bileşenlere bildirim için gerekli
        setIsResizing(true)

        // Cursor ve selection stillerini ayarla
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'

        // Resizer'a dragging class'ı ekle (CSS animasyonları için)
        if (resizerRef.current) {
            resizerRef.current.classList.add('dragging')
        }

        // Mevcut genişliği pending ref'e kaydet
        pendingWidthRef.current = leftPanelWidth
    }, [leftPanelWidth])

    // Mouse move ve mouse up event listener'ları
    useEffect(() => {
        // requestAnimationFrame ile throttle edilmiş DOM güncellemesi
        const updatePanelWidth = (percentage: number) => {
            if (leftPanelRef.current) {
                leftPanelRef.current.style.width = `${percentage}%`
            }
        }

        const handleMouseMove = (e: MouseEvent) => {
            // REF kontrolü - state kontrolünden daha hızlı
            if (!isResizingRef.current) return

            const containerWidth = window.innerWidth
            let newWidthPx: number

            // Resizer genişliğini hesaba katarak panel genişliğini hesapla
            if (isReversed) {
                // Resize bar (6px) hesaba katılıyor
                // Mouse sağdan ne kadar uzak? 
                newWidthPx = containerWidth - e.clientX - (RESIZER_WIDTH / 2)
            } else {
                newWidthPx = e.clientX
            }

            // Limitleri kontrol et (Min sol ve min sağ panel genişlikleri)
            // isReversed ise minLeft aslında "Min Resizable Panel Width" (Right Panel)
            // minRight ise "Min Flex Panel Width" (Left Panel)
            const maxAllowedWidth = containerWidth - minRight - RESIZER_WIDTH

            if (newWidthPx >= minLeft && newWidthPx <= maxAllowedWidth) {
                const percentage = (newWidthPx / containerWidth) * 100

                // PERFORMANS: State güncellemesi YOK!
                // Sadece ref'e kaydet
                pendingWidthRef.current = percentage

                // requestAnimationFrame ile bir sonraki frame'de güncelle
                // Bu, browser'ın paint cycle'ı ile senkronize çalışır
                if (rafIdRef.current) {
                    cancelAnimationFrame(rafIdRef.current)
                }
                rafIdRef.current = requestAnimationFrame(() => {
                    updatePanelWidth(percentage)
                })
            }
        }

        const handleMouseUp = () => {
            // REF kontrolü
            if (!isResizingRef.current) return

            // REF'i sıfırla
            isResizingRef.current = false

            // Bekleyen RAF'ı iptal et
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current)
                rafIdRef.current = null
            }

            // Cursor ve selection stillerini sıfırla
            document.body.style.cursor = ''
            document.body.style.userSelect = ''

            // Resizer'dan dragging class'ını kaldır
            if (resizerRef.current) {
                resizerRef.current.classList.remove('dragging')
            }

            // STATE güncelle (sadece 1 kez, bitişte)
            // Bu, isResizing prop'unu kullanan bileşenlere bildirim için gerekli
            setIsResizing(false)

            // Final değeri state'e kaydet → tek bir re-render
            // Bu aynı zamanda localStorage'a da kaydeder (useLocalStorage sayesinde)
            setLeftPanelWidth(pendingWidthRef.current)
        }

        // Event listener'ları ekle
        document.addEventListener('mousemove', handleMouseMove, { passive: true })
        document.addEventListener('mouseup', handleMouseUp)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)

            // Cleanup: bekleyen RAF'ı iptal et
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current)
            }
        }
    }, [minLeft, minRight, setLeftPanelWidth, isReversed]) // isResizing bağımlılığı KALDIRILDI - artık ref kullanıyoruz

    return {
        leftPanelWidth,
        setLeftPanelWidth,
        isResizing,
        handleMouseDown,
        // Panel ref'lerini dışarı ver - App.jsx'te panellere bağlanacak
        leftPanelRef,
        // Resizer ref'i - class toggle için
        resizerRef
    }
}


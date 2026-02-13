import { useState, useEffect, useCallback, useRef } from 'react'
import type { RefObject, MutableRefObject } from 'react'
import { STORAGE_KEYS } from '@src/constants/storageKeys'

/**
 * PDF sayfa navigasyonunu ve mouse wheel (kaydırma) event'lerini yöneten custom hook.
 * Tek sayfa modunda (ScrollMode.Page) fare tekerleği ile sayfa geçişini sağlar.
 * 
 * @param {Object} options - Hook options
 * @param {React.RefObject} options.containerRef - PDF container ref
 * @param {React.RefObject} options.jumpToPageRef - jumpToPage fonksiyonu ref'i
 */
type PageChangeEvent = { currentPage: number }
type DocumentLoadEvent = { doc: { numPages: number } }

interface UsePdfNavigationOptions {
    containerRef: RefObject<HTMLDivElement | null>;
    jumpToPageRef: MutableRefObject<(pageIndex: number) => void>;
}

export function usePdfNavigation({ containerRef, jumpToPageRef }: UsePdfNavigationOptions) {
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0)

    // Throttle için ref'ler
    const lastWheelTime = useRef(0)
    const accumulatedDelta = useRef(0)
    const DELTA_THRESHOLD = 50 // Sayfa değişimi için gereken minimum kaydırma miktarı
    const THROTTLE_MS = 600 // Sayfa değişimleri arasındaki minimum süre (ms)

    // Mevcut sayfayı ref'te tut (wheel handler içinde güncel değeri görmek için)
    const currentPageRef = useRef(currentPage)
    useEffect(() => {
        currentPageRef.current = currentPage
    }, [currentPage])

    // Fare tekerleği ile sayfa değiştirme mantığı
    const handleWheel = useCallback((e: WheelEvent) => {
        if (totalPages === 0) return

        // Ctrl (Windows/Linux) veya Cmd (Mac) basılıysa zoom yapılıyor demektir
        // Bu durumda PDF viewer'ın native zoom mekanizmasını kullan
        if (e.ctrlKey || e.metaKey) {
            return // Zoom event'ini viewer'a bırak
        }

        const now = Date.now()

        // Çok hızlı kaydırmayı engelle (throttle)
        if (now - lastWheelTime.current < THROTTLE_MS) {
            e.preventDefault()
            return
        }

        // Kısa süre işlem yapılmadıysa birikmeyi sıfırla
        if (now - lastWheelTime.current > 200) {
            accumulatedDelta.current = 0
        }

        accumulatedDelta.current += e.deltaY

        // Yeterli kaydırma birikti mi kontrol et
        if (Math.abs(accumulatedDelta.current) >= DELTA_THRESHOLD) {
            e.preventDefault()
            const current = currentPageRef.current

            if (accumulatedDelta.current > 0) {
                // Aşağı kaydırma -> Sonraki Sayfa
                if (current < totalPages) {
                    jumpToPageRef.current(current) // 0-indexed (current 1-indexed olduğu için +1 e gerek yok)
                    lastWheelTime.current = now
                }
            } else {
                // Yukarı kaydırma -> Önceki Sayfa
                if (current > 1) {
                    jumpToPageRef.current(current - 2) // 0-indexed
                    lastWheelTime.current = now
                }
            }
            accumulatedDelta.current = 0
        }
    }, [totalPages, jumpToPageRef])

    // Event listener'ı bağla - sayfa geçişi için wheel event'i kullan
    // Not: Ctrl+wheel zoom engelleme PdfViewer.jsx'te yapılıyor
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        // passive: false -> preventDefault kullanabilmek için kritik
        container.addEventListener('wheel', handleWheel, { passive: false })

        return () => {
            container.removeEventListener('wheel', handleWheel)
        }
    }, [handleWheel, containerRef])

    // Sayfa değişikliğini izle (Viewer'dan gelen event)
    const handlePageChange = useCallback((e: PageChangeEvent) => {
        const newPage = e.currentPage + 1
        setCurrentPage(newPage)

        // Son okunan sayfayı localStorage'a kaydet
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING)
            if (stored) {
                const data = JSON.parse(stored)
                data.page = newPage
                localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify(data))
            }
        } catch { /* ignore */ }
    }, [])

    // PDF yüklendiğinde toplam sayfa sayısını al ve localStorage'a kaydet
    const handleDocumentLoad = useCallback((e: DocumentLoadEvent) => {
        setTotalPages(e.doc.numPages)

        // totalPages bilgisini localStorage'a kaydet
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING)
            if (stored) {
                const data = JSON.parse(stored)
                data.totalPages = e.doc.numPages
                localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify(data))
            }
        } catch { /* ignore */ }
    }, [])

    // Butonlar için manuel navigasyon fonksiyonları
    const goToPreviousPage = useCallback(() => {
        if (currentPage > 1 && jumpToPageRef.current) {
            jumpToPageRef.current(currentPage - 2)
        }
    }, [currentPage, jumpToPageRef])

    const goToNextPage = useCallback(() => {
        if (currentPage < totalPages && jumpToPageRef.current) {
            jumpToPageRef.current(currentPage)
        }
    }, [currentPage, totalPages, jumpToPageRef])

    return {
        currentPage,
        totalPages,
        handlePageChange,
        handleDocumentLoad,
        goToPreviousPage,
        goToNextPage
    }
}

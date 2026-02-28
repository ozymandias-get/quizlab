import { useState, useEffect, useCallback, useRef } from 'react'
import type { RefObject, MutableRefObject } from 'react'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'

/**
 * PDF sayfa navigasyonunu ve mouse wheel (kaydÄ±rma) event'lerini yÃ¶neten custom hook.
 * Tek sayfa modunda (ScrollMode.Page) fare tekerleÄŸi ile sayfa geÃ§iÅŸini saÄŸlar.
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

    // Throttle iÃ§in ref'ler
    const lastWheelTime = useRef(0)
    const accumulatedDelta = useRef(0)
    const DELTA_THRESHOLD = 50 // Sayfa deÄŸiÅŸimi iÃ§in gereken minimum kaydÄ±rma miktarÄ±
    const THROTTLE_MS = 600 // Sayfa deÄŸiÅŸimleri arasÄ±ndaki minimum sÃ¼re (ms)

    // Mevcut sayfayÄ± ref'te tut (wheel handler iÃ§inde gÃ¼ncel deÄŸeri gÃ¶rmek iÃ§in)
    const currentPageRef = useRef(currentPage)
    useEffect(() => {
        currentPageRef.current = currentPage
    }, [currentPage])

    // Fare tekerleÄŸi ile sayfa deÄŸiÅŸtirme mantÄ±ÄŸÄ±
    const handleWheel = useCallback((e: WheelEvent) => {
        if (totalPages === 0) return

        // Ctrl (Windows/Linux) veya Cmd (Mac) basÄ±lÄ±ysa zoom yapÄ±lÄ±yor demektir
        // Bu durumda PDF viewer'Ä±n native zoom mekanizmasÄ±nÄ± kullan
        if (e.ctrlKey || e.metaKey) {
            return // Zoom event'ini viewer'a bÄ±rak
        }

        const now = Date.now()

        // Ã‡ok hÄ±zlÄ± kaydÄ±rmayÄ± engelle (throttle)
        if (now - lastWheelTime.current < THROTTLE_MS) {
            e.preventDefault()
            return
        }

        // KÄ±sa sÃ¼re iÅŸlem yapÄ±lmadÄ±ysa birikmeyi sÄ±fÄ±rla
        if (now - lastWheelTime.current > 200) {
            accumulatedDelta.current = 0
        }

        accumulatedDelta.current += e.deltaY

        // Yeterli kaydÄ±rma birikti mi kontrol et
        if (Math.abs(accumulatedDelta.current) >= DELTA_THRESHOLD) {
            e.preventDefault()
            const current = currentPageRef.current

            if (accumulatedDelta.current > 0) {
                // AÅŸaÄŸÄ± kaydÄ±rma -> Sonraki Sayfa
                if (current < totalPages) {
                    jumpToPageRef.current(current) // 0-indexed (current 1-indexed olduÄŸu iÃ§in +1 e gerek yok)
                    lastWheelTime.current = now
                }
            } else {
                // YukarÄ± kaydÄ±rma -> Ã–nceki Sayfa
                if (current > 1) {
                    jumpToPageRef.current(current - 2) // 0-indexed
                    lastWheelTime.current = now
                }
            }
            accumulatedDelta.current = 0
        }
    }, [totalPages, jumpToPageRef])

    // Event listener'Ä± baÄŸla - sayfa geÃ§iÅŸi iÃ§in wheel event'i kullan
    // Not: Ctrl+wheel zoom engelleme PdfViewer.jsx'te yapÄ±lÄ±yor
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        // passive: false -> preventDefault kullanabilmek iÃ§in kritik
        container.addEventListener('wheel', handleWheel, { passive: false })

        return () => {
            container.removeEventListener('wheel', handleWheel)
        }
    }, [handleWheel, containerRef])

    // Sayfa deÄŸiÅŸikliÄŸini izle (Viewer'dan gelen event)
    const handlePageChange = useCallback((e: PageChangeEvent) => {
        const newPage = e.currentPage + 1
        setCurrentPage(newPage)

        // Son okunan sayfayÄ± localStorage'a kaydet
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING)
            if (stored) {
                const data = JSON.parse(stored)
                data.page = newPage
                localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify(data))
            }
        } catch { /* ignore */ }
    }, [])

    // PDF yÃ¼klendiÄŸinde toplam sayfa sayÄ±sÄ±nÄ± al ve localStorage'a kaydet
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

    // Butonlar iÃ§in manuel navigasyon fonksiyonlarÄ±
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



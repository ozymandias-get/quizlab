import { useState, useEffect, useCallback, useRef } from 'react'
import type { RefObject, MutableRefObject } from 'react'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'

type PageChangeEvent = { currentPage: number }
type DocumentLoadEvent = { doc: { numPages: number } }

interface UsePdfNavigationOptions {
    containerRef: RefObject<HTMLDivElement | null>;
    jumpToPageRef: MutableRefObject<(pageIndex: number) => void>;
    pdfPath?: string | null;
}

export function usePdfNavigation({ containerRef, jumpToPageRef, pdfPath }: UsePdfNavigationOptions) {
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0)

    const lastNavigationTime = useRef(0)
    const lastWheelEventTime = useRef(0)
    const accumulatedDelta = useRef(0)
    const DELTA_THRESHOLD = 50
    const THROTTLE_MS = 600

    const currentPageRef = useRef(currentPage)
    useEffect(() => {
        currentPageRef.current = currentPage
    }, [currentPage])

    const handleWheel = useCallback((e: WheelEvent) => {
        if (totalPages === 0) return

        if (e.ctrlKey || e.metaKey) {
            return
        }

        const now = Date.now()
        const sinceLastWheelEvent = now - lastWheelEventTime.current
        if (sinceLastWheelEvent > 220) {
            accumulatedDelta.current = 0
        }

        accumulatedDelta.current += e.deltaY
        lastWheelEventTime.current = now

        if (Math.abs(accumulatedDelta.current) < DELTA_THRESHOLD) {
            return
        }

        if (now - lastNavigationTime.current < THROTTLE_MS) {
            e.preventDefault()
            accumulatedDelta.current = 0
            return
        }

        e.preventDefault()
        const current = currentPageRef.current

        if (accumulatedDelta.current > 0) {
            if (current < totalPages) {
                jumpToPageRef.current(current)
                lastNavigationTime.current = now
            }
        } else if (current > 1) {
            jumpToPageRef.current(current - 2)
            lastNavigationTime.current = now
        }

        accumulatedDelta.current = 0
    }, [totalPages, jumpToPageRef])

    useEffect(() => {
        lastNavigationTime.current = 0
        lastWheelEventTime.current = 0
        accumulatedDelta.current = 0
    }, [pdfPath])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        container.addEventListener('wheel', handleWheel, { passive: false })
        return () => {
            container.removeEventListener('wheel', handleWheel)
        }
    }, [handleWheel, containerRef])

    const updateStoredReadingInfo = useCallback((updates: Partial<{ page: number; totalPages: number; lastOpenedAt: number }>) => {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING)
            if (!stored) return

            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed)) {
                if (parsed.length === 0) return

                const targetIndex = pdfPath
                    ? parsed.findIndex((item) => item && typeof item === 'object' && item.path === pdfPath)
                    : 0
                const index = targetIndex >= 0 ? targetIndex : 0
                const target = parsed[index]
                if (!target || typeof target !== 'object') return

                const next = [...parsed]
                next[index] = { ...target, ...updates }
                localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify(next))
                return
            }

            if (parsed && typeof parsed === 'object') {
                localStorage.setItem(
                    STORAGE_KEYS.LAST_PDF_READING,
                    JSON.stringify({ ...parsed, ...updates })
                )
            }
        } catch {
            // ignore localStorage errors
        }
    }, [pdfPath])

    const handlePageChange = useCallback((e: PageChangeEvent) => {
        const newPage = e.currentPage + 1
        setCurrentPage(newPage)
        updateStoredReadingInfo({ page: newPage, lastOpenedAt: Date.now() })
    }, [updateStoredReadingInfo])

    const handleDocumentLoad = useCallback((e: DocumentLoadEvent) => {
        setTotalPages(e.doc.numPages)
        updateStoredReadingInfo({ totalPages: e.doc.numPages, lastOpenedAt: Date.now() })
    }, [updateStoredReadingInfo])

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

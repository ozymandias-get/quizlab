import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type MutableRefObject,
  type RefObject
} from 'react'
import type { ReadingProgressUpdate } from '@features/pdf/hooks/usePdfSelection'

type PageChangeEvent = { currentPage: number }
type DocumentLoadEvent = { doc: { numPages: number } }

interface UsePdfNavigationOptions {
  containerRef: RefObject<HTMLDivElement | null>
  jumpToPageRef: MutableRefObject<(pageIndex: number) => void>
  pdfPath?: string | null
  initialPage?: number
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
}

const WHEEL_DELTA_THRESHOLD = 50
const WHEEL_GESTURE_RESET_MS = 180
const WHEEL_NAVIGATION_FALLBACK_MS = 500
const WHEEL_POST_NAVIGATION_LOCK_MS = 320

export function usePdfNavigation({
  containerRef,
  jumpToPageRef,
  pdfPath,
  initialPage,
  onReadingProgressChange
}: UsePdfNavigationOptions) {
  const [currentPage, setCurrentPage] = useState(() =>
    initialPage && initialPage > 0 ? initialPage : 1
  )
  const [totalPages, setTotalPages] = useState(0)
  const currentPageRef = useRef(currentPage)
  const accumulatedDeltaRef = useRef(0)
  const lastWheelEventAtRef = useRef(0)
  const pendingTargetPageRef = useRef<number | null>(null)
  const pendingNavigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wheelLockedUntilRef = useRef(0)

  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  const clearPendingNavigation = useCallback(() => {
    if (pendingNavigationTimerRef.current) {
      clearTimeout(pendingNavigationTimerRef.current)
      pendingNavigationTimerRef.current = null
    }
    pendingTargetPageRef.current = null
  }, [])

  const resetWheelGesture = useCallback(() => {
    accumulatedDeltaRef.current = 0
    lastWheelEventAtRef.current = 0
  }, [])

  const lockWheelGesture = useCallback(() => {
    wheelLockedUntilRef.current = Date.now() + WHEEL_POST_NAVIGATION_LOCK_MS
    resetWheelGesture()
  }, [resetWheelGesture])

  useEffect(() => {
    clearPendingNavigation()
    resetWheelGesture()
    setCurrentPage(initialPage && initialPage > 0 ? initialPage : 1)
    setTotalPages(0)
  }, [clearPendingNavigation, pdfPath, resetWheelGesture])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || totalPages <= 0) {
        return
      }

      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return
      }

      const now = Date.now()
      if (now < wheelLockedUntilRef.current) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (now - lastWheelEventAtRef.current > WHEEL_GESTURE_RESET_MS) {
        accumulatedDeltaRef.current = 0
      }

      accumulatedDeltaRef.current += event.deltaY
      lastWheelEventAtRef.current = now

      if (Math.abs(accumulatedDeltaRef.current) < WHEEL_DELTA_THRESHOLD) {
        return
      }

      const current = currentPageRef.current
      const direction = accumulatedDeltaRef.current > 0 ? 1 : -1
      const targetPage = Math.min(totalPages, Math.max(1, current + direction))
      accumulatedDeltaRef.current = 0

      if (targetPage === current || pendingTargetPageRef.current !== null) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      lockWheelGesture()
      pendingTargetPageRef.current = targetPage
      pendingNavigationTimerRef.current = setTimeout(() => {
        clearPendingNavigation()
      }, WHEEL_NAVIGATION_FALLBACK_MS)

      jumpToPageRef.current(targetPage - 1)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
      clearPendingNavigation()
    }
  }, [clearPendingNavigation, containerRef, jumpToPageRef, lockWheelGesture, totalPages])

  const handlePageChange = useCallback(
    (e: PageChangeEvent) => {
      const newPage = e.currentPage + 1
      setCurrentPage(newPage)
      if (pendingTargetPageRef.current === newPage) {
        clearPendingNavigation()
      }
      lockWheelGesture()
      if (!pdfPath) return

      onReadingProgressChange?.({
        path: pdfPath,
        page: newPage,
        lastOpenedAt: Date.now()
      })
    },
    [clearPendingNavigation, lockWheelGesture, onReadingProgressChange, pdfPath]
  )

  const handleDocumentLoad = useCallback(
    (e: DocumentLoadEvent) => {
      setTotalPages(e.doc.numPages)
      if (!pdfPath) return

      onReadingProgressChange?.({
        path: pdfPath,
        totalPages: e.doc.numPages,
        lastOpenedAt: Date.now()
      })
    },
    [onReadingProgressChange, pdfPath]
  )

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

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type RefObject,
  type MutableRefObject
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

  const lastNavigationTime = useRef(0)
  const lastWheelEventTime = useRef(0)
  const accumulatedDelta = useRef(0)
  const DELTA_THRESHOLD = 50
  const THROTTLE_MS = 600

  const currentPageRef = useRef(currentPage)
  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
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
    },
    [totalPages, jumpToPageRef]
  )

  useEffect(() => {
    lastNavigationTime.current = 0
    lastWheelEventTime.current = 0
    accumulatedDelta.current = 0
    setCurrentPage(initialPage && initialPage > 0 ? initialPage : 1)
    setTotalPages(0)
  }, [pdfPath])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel, containerRef])

  const handlePageChange = useCallback(
    (e: PageChangeEvent) => {
      const newPage = e.currentPage + 1
      setCurrentPage(newPage)
      if (!pdfPath) return

      onReadingProgressChange?.({
        path: pdfPath,
        page: newPage,
        lastOpenedAt: Date.now()
      })
    },
    [onReadingProgressChange, pdfPath]
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

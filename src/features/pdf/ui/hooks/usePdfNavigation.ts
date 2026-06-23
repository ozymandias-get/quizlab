import type { ReadingProgressUpdate } from '@features/pdf/hooks/types'

import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

type PageChangeEvent = { currentPage: number }
type DocumentLoadEvent = { doc: { numPages: number } }

interface UsePdfNavigationOptions {
  containerRef: RefObject<HTMLDivElement | null>
  jumpToPageRef: MutableRefObject<(pageIndex: number) => void>
  pdfPath?: string | null
  initialPage?: number
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
}

const PROGRESS_DEBOUNCE_MS = 300
const NAVIGATION_ACK_TIMEOUT_MS = 1200
const NAVIGATION_SETTLE_MS = 450

export function usePdfNavigation({
  containerRef: _containerRef,
  jumpToPageRef,
  pdfPath,
  initialPage,
  onReadingProgressChange
}: UsePdfNavigationOptions) {
  const [currentPage, setCurrentPage] = useState(() =>
    initialPage && initialPage > 0 ? initialPage : 1
  )
  const [totalPages, setTotalPages] = useState(0)

  // Senkron ref — render sırasında güncellenir, callback'lerde güncel değer okunur
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage

  const totalPagesRef = useRef(totalPages)
  totalPagesRef.current = totalPages

  const progressDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigationTargetPageRef = useRef<number | null>(null)
  const navigationAckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigationAcknowledgedRef = useRef(false)

  const onReadingProgressChangeRef = useRef(onReadingProgressChange)
  onReadingProgressChangeRef.current = onReadingProgressChange

  const scheduleProgressUpdate = useCallback(
    (page: number) => {
      if (progressDebounceTimerRef.current) {
        clearTimeout(progressDebounceTimerRef.current)
      }
      progressDebounceTimerRef.current = setTimeout(() => {
        progressDebounceTimerRef.current = null
        if (!pdfPath) return
        onReadingProgressChangeRef.current?.({
          path: pdfPath,
          page,
          lastOpenedAt: Date.now()
        })
      }, PROGRESS_DEBOUNCE_MS)
    },
    [pdfPath]
  )

  useEffect(() => {
    navigationTargetPageRef.current = null
    navigationAcknowledgedRef.current = false
    if (navigationAckTimerRef.current !== null) {
      clearTimeout(navigationAckTimerRef.current)
      navigationAckTimerRef.current = null
    }
    setCurrentPage(initialPage && initialPage > 0 ? initialPage : 1)
    setTotalPages(0)
  }, [pdfPath])

  useEffect(
    () => () => {
      if (progressDebounceTimerRef.current !== null) {
        clearTimeout(progressDebounceTimerRef.current)
      }
      if (navigationAckTimerRef.current !== null) {
        clearTimeout(navigationAckTimerRef.current)
      }
    },
    []
  )

  const handlePageChange = useCallback(
    (e: PageChangeEvent) => {
      const newPage = e.currentPage + 1
      const navigationTarget = navigationTargetPageRef.current

      // jumpToPage can trigger a late callback for the page being unmounted.
      // Accepting it after the target callback makes currentPage flip back and
      // can send the next wheel event in the opposite direction. While a jump
      // is pending, only its exact target is authoritative.
      if (navigationTarget !== null && newPage !== navigationTarget) {
        return
      }

      if (navigationTarget === newPage && !navigationAcknowledgedRef.current) {
        navigationAcknowledgedRef.current = true
        if (navigationAckTimerRef.current !== null) {
          clearTimeout(navigationAckTimerRef.current)
        }
        // Keep the target authoritative for a short settle period. Canvas and
        // text-layer teardown can emit stale source-page callbacks after the
        // target callback, especially when wheel input is fast.
        navigationAckTimerRef.current = setTimeout(() => {
          navigationAckTimerRef.current = null
          navigationTargetPageRef.current = null
          navigationAcknowledgedRef.current = false
        }, NAVIGATION_SETTLE_MS)
      }

      if (currentPageRef.current !== newPage) {
        currentPageRef.current = newPage
        setCurrentPage(newPage)
      }
      scheduleProgressUpdate(newPage)
    },
    [scheduleProgressUpdate]
  )

  const handleDocumentLoad = useCallback(
    (e: DocumentLoadEvent) => {
      const numPages = e.doc.numPages
      if (totalPagesRef.current === numPages) return
      setTotalPages(numPages)
      if (!pdfPath) return
      onReadingProgressChangeRef.current?.({
        path: pdfPath,
        totalPages: numPages,
        lastOpenedAt: Date.now()
      })
    },
    [pdfPath]
  )

  const performJumpToPage = useCallback(
    (pageIndex: number) => {
      // Serialize page jumps. Overwriting an in-flight target is the main
      // source of rapid-scroll oscillation: callbacks from two transitions
      // race and alternately make each page authoritative.
      if (navigationTargetPageRef.current !== null) return

      const jumpFn = jumpToPageRef.current
      if (jumpFn) {
        navigationTargetPageRef.current = pageIndex + 1
        navigationAcknowledgedRef.current = false
        if (navigationAckTimerRef.current !== null) {
          clearTimeout(navigationAckTimerRef.current)
        }
        navigationAckTimerRef.current = setTimeout(() => {
          navigationAckTimerRef.current = null
          navigationTargetPageRef.current = null
          navigationAcknowledgedRef.current = false
        }, NAVIGATION_ACK_TIMEOUT_MS)
        jumpFn(pageIndex)
      }
    },
    [jumpToPageRef]
  )

  const goToPreviousPage = useCallback(() => {
    const current = currentPageRef.current
    if (current > 1) {
      performJumpToPage(current - 2)
    }
  }, [performJumpToPage])

  const goToNextPage = useCallback(() => {
    const current = currentPageRef.current
    if (current < totalPagesRef.current) {
      performJumpToPage(current)
    }
  }, [performJumpToPage])

  const jumpToPage = useCallback(
    (page: number) => {
      performJumpToPage(page - 1)
    },
    [performJumpToPage]
  )

  return {
    currentPage,
    totalPages,
    currentPageRef,
    handlePageChange,
    handleDocumentLoad,
    goToPreviousPage,
    goToNextPage,
    jumpToPage
  }
}

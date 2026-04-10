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
type WheelDirection = -1 | 0 | 1

interface WheelGestureState {
  accumulatedDelta: number
  direction: WheelDirection
  lastEventAt: number
  lockUntil: number
  pendingTargetPage: number | null
}

interface UsePdfNavigationOptions {
  containerRef: RefObject<HTMLDivElement | null>
  jumpToPageRef: MutableRefObject<(pageIndex: number) => void>
  pdfPath?: string | null
  initialPage?: number
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
}

const WHEEL_INTENT_THRESHOLD_PX = 50
const WHEEL_GESTURE_IDLE_MS = 180
const WHEEL_NAVIGATION_FALLBACK_MS = 500
const WHEEL_POST_NAVIGATION_LOCK_MS = 360
const WHEEL_LINE_DELTA_PX = 16
const WHEEL_PAGE_DELTA_PX = 800

const createWheelGestureState = (): WheelGestureState => ({
  accumulatedDelta: 0,
  direction: 0,
  lastEventAt: 0,
  lockUntil: 0,
  pendingTargetPage: null
})

const normalizeWheelDelta = (delta: number, deltaMode: number) => {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return delta * WHEEL_LINE_DELTA_PX
  }
  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return delta * WHEEL_PAGE_DELTA_PX
  }
  return delta
}

const claimWheelEvent = (event: WheelEvent) => {
  event.preventDefault()
  event.stopPropagation()
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
  const currentPageRef = useRef(currentPage)
  const wheelGestureRef = useRef<WheelGestureState>(createWheelGestureState())
  const pendingNavigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  const clearPendingNavigation = useCallback(() => {
    if (pendingNavigationTimerRef.current) {
      clearTimeout(pendingNavigationTimerRef.current)
      pendingNavigationTimerRef.current = null
    }
    wheelGestureRef.current.pendingTargetPage = null
  }, [])

  const resetWheelIntent = useCallback(() => {
    const gesture = wheelGestureRef.current
    gesture.accumulatedDelta = 0
    gesture.direction = 0
    gesture.lastEventAt = 0
  }, [])

  const lockWheelAfterNavigation = useCallback(() => {
    const gesture = wheelGestureRef.current
    gesture.lockUntil = Date.now() + WHEEL_POST_NAVIGATION_LOCK_MS
    gesture.accumulatedDelta = 0
    gesture.direction = 0
    gesture.lastEventAt = 0
  }, [])

  useEffect(() => {
    clearPendingNavigation()
    wheelGestureRef.current = createWheelGestureState()
    setCurrentPage(initialPage && initialPage > 0 ? initialPage : 1)
    setTotalPages(0)
  }, [clearPendingNavigation, pdfPath])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || totalPages <= 0) {
        return
      }

      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode)
      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode)
      if (Math.abs(deltaY) <= Math.abs(deltaX)) {
        return
      }

      claimWheelEvent(event)

      const now = Date.now()
      const gesture = wheelGestureRef.current
      if (gesture.pendingTargetPage !== null) {
        gesture.lastEventAt = now
        return
      }

      if (now < gesture.lockUntil) {
        gesture.lastEventAt = now
        return
      }

      if (gesture.lockUntil > 0) {
        if (now - gesture.lastEventAt <= WHEEL_GESTURE_IDLE_MS) {
          gesture.lastEventAt = now
          return
        }
        gesture.lockUntil = 0
        resetWheelIntent()
      }

      if (now - gesture.lastEventAt > WHEEL_GESTURE_IDLE_MS) {
        resetWheelIntent()
      }

      const direction = Math.sign(deltaY) as WheelDirection
      if (direction === 0) {
        return
      }

      if (gesture.direction !== 0 && gesture.direction !== direction) {
        gesture.accumulatedDelta = 0
      }

      gesture.direction = direction
      gesture.accumulatedDelta += Math.abs(deltaY)
      gesture.lastEventAt = now

      if (gesture.accumulatedDelta < WHEEL_INTENT_THRESHOLD_PX) {
        return
      }

      const current = currentPageRef.current
      const targetPage = Math.min(totalPages, Math.max(1, current + direction))
      resetWheelIntent()

      if (targetPage === current) {
        return
      }

      lockWheelAfterNavigation()
      wheelGestureRef.current.pendingTargetPage = targetPage
      pendingNavigationTimerRef.current = setTimeout(() => {
        clearPendingNavigation()
      }, WHEEL_NAVIGATION_FALLBACK_MS)

      jumpToPageRef.current(targetPage - 1)
    }

    const wheelOpts: AddEventListenerOptions = { passive: false, capture: true }
    container.addEventListener('wheel', handleWheel, wheelOpts)

    return () => {
      container.removeEventListener('wheel', handleWheel, wheelOpts)
      clearPendingNavigation()
    }
  }, [
    clearPendingNavigation,
    containerRef,
    jumpToPageRef,
    lockWheelAfterNavigation,
    resetWheelIntent,
    totalPages
  ])

  const handlePageChange = useCallback(
    (e: PageChangeEvent) => {
      const newPage = e.currentPage + 1
      if (currentPageRef.current === newPage) {
        if (wheelGestureRef.current.pendingTargetPage === newPage) {
          clearPendingNavigation()
        }
        lockWheelAfterNavigation()
        if (!pdfPath) return

        onReadingProgressChange?.({
          path: pdfPath,
          page: newPage,
          lastOpenedAt: Date.now()
        })
        return
      }
      setCurrentPage(newPage)
      if (wheelGestureRef.current.pendingTargetPage === newPage) {
        clearPendingNavigation()
      }
      lockWheelAfterNavigation()
      if (!pdfPath) return

      onReadingProgressChange?.({
        path: pdfPath,
        page: newPage,
        lastOpenedAt: Date.now()
      })
    },
    [clearPendingNavigation, lockWheelAfterNavigation, onReadingProgressChange, pdfPath]
  )

  const handleDocumentLoad = useCallback(
    (e: DocumentLoadEvent) => {
      if (totalPages === e.doc.numPages) {
        return
      }
      setTotalPages(e.doc.numPages)
      if (!pdfPath) return

      onReadingProgressChange?.({
        path: pdfPath,
        totalPages: e.doc.numPages,
        lastOpenedAt: Date.now()
      })
    },
    [onReadingProgressChange, pdfPath, totalPages]
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

import {
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  calculatePanelBounds,
  clampPanelPercentage,
  DEFAULT_RESIZER_WIDTH,
  setBodyResizingState,
  WIDTH_CHANGE_THRESHOLD
} from './panelResize/panelResizeUtils'
import { useLocalStorage } from './useLocalStorage'

interface UsePanelResizeOptions {
  initialWidth?: number
  minLeft?: number
  minRight?: number
  storageKey: string
  isReversed?: boolean
  resizerWidth?: number
}

interface UsePanelResizeReturn {
  leftPanelWidth: number
  setLeftPanelWidth: Dispatch<SetStateAction<number>>
  isResizing: boolean
  handlePointerDown: (e: ReactPointerEvent) => void
  handlePointerMove: (e: ReactPointerEvent) => void
  handlePointerUp: (e: ReactPointerEvent) => void
  handleLostPointerCapture: (e: ReactPointerEvent) => void
  nudgeLeftPanelWidth: (deltaPx: number) => void
  leftPanelRef: RefObject<HTMLElement | null>
  resizerRef: RefObject<HTMLElement | null>
}

export function usePanelResize({
  initialWidth = 50,
  minLeft = 300,
  minRight = 400,
  storageKey,
  isReversed = false,
  resizerWidth = DEFAULT_RESIZER_WIDTH
}: UsePanelResizeOptions): UsePanelResizeReturn {
  const [leftPanelWidth, setLeftPanelWidth] = useLocalStorage<number>(storageKey, initialWidth)
  const [isResizing, setIsResizing] = useState<boolean>(false)
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    let rafId: number | null = null
    const handleResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        setWindowWidth(window.innerWidth)
      })
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  const { effectiveResizerWidth, safeMinLeft, safeMaxLeft } = calculatePanelBounds(
    windowWidth,
    resizerWidth,
    minLeft,
    minRight
  )

  const clampedPercentage = clampPanelPercentage(
    leftPanelWidth,
    windowWidth,
    safeMinLeft,
    safeMaxLeft
  )

  const leftPanelRef = useRef<HTMLElement | null>(null)
  const resizerRef = useRef<HTMLElement | null>(null)
  const pendingWidthRef = useRef<number>(clampedPercentage)
  const startWidthRef = useRef<number>(clampedPercentage)
  const isResizingRef = useRef<boolean>(false)
  const rafIdRef = useRef<number | null>(null)
  const leftPanelWidthRef = useRef(clampedPercentage)
  leftPanelWidthRef.current = clampedPercentage

  const endResize = useCallback(() => {
    if (!isResizingRef.current) return
    isResizingRef.current = false
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    setBodyResizingState(false)
    resizerRef.current?.classList.remove('dragging')

    const finalWidth = pendingWidthRef.current
    const widthDiff = Math.abs(finalWidth - startWidthRef.current)
    setIsResizing(false)

    if (widthDiff >= WIDTH_CHANGE_THRESHOLD) {
      setLeftPanelWidth(finalWidth)
    }
  }, [setLeftPanelWidth])

  const handlePointerDown = useCallback((e: ReactPointerEvent) => {
    e.preventDefault()
    isResizingRef.current = true
    setBodyResizingState(true)
    setIsResizing(true)
    resizerRef.current?.classList.add('dragging')

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Degrades gracefully if element detached
    }

    pendingWidthRef.current = leftPanelWidthRef.current
    startWidthRef.current = leftPanelWidthRef.current
  }, [])

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!isResizingRef.current) return

      const containerWidth = window.innerWidth
      const bounds = calculatePanelBounds(containerWidth, effectiveResizerWidth, minLeft, minRight)
      const newWidthPx = isReversed
        ? containerWidth - e.clientX - effectiveResizerWidth / 2
        : e.clientX

      const clampedWidthPxVal = Math.max(
        bounds.safeMinLeft,
        Math.min(newWidthPx, bounds.safeMaxLeft)
      )
      const percentage = (clampedWidthPxVal / containerWidth) * 100
      pendingWidthRef.current = percentage

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
      rafIdRef.current = requestAnimationFrame(() => {
        if (leftPanelRef.current) {
          leftPanelRef.current.style.width = `${percentage}%`
        }
      })
    },
    [effectiveResizerWidth, isReversed, minLeft, minRight]
  )

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent) => {
      try {
        resizerRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        // Safe to ignore
      }
      endResize()
    },
    [endResize]
  )

  const handleLostPointerCapture = useCallback(() => {
    endResize()
  }, [endResize])

  const nudgeLeftPanelWidth = useCallback(
    (deltaPx: number) => {
      const containerWidth = window.innerWidth
      const bounds = calculatePanelBounds(containerWidth, effectiveResizerWidth, minLeft, minRight)
      const currentPx = (leftPanelWidthRef.current / 100) * containerWidth
      const nextPx = Math.max(bounds.safeMinLeft, Math.min(currentPx + deltaPx, bounds.safeMaxLeft))
      const nextPercentage = containerWidth > 0 ? (nextPx / containerWidth) * 100 : 50
      leftPanelWidthRef.current = nextPercentage
      setLeftPanelWidth(nextPercentage)
    },
    [minLeft, minRight, effectiveResizerWidth, setLeftPanelWidth]
  )

  const endResizeRef = useRef(endResize)
  endResizeRef.current = endResize

  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
      if (isResizingRef.current) {
        endResizeRef.current()
      }
    }
  }, [])

  return useMemo(
    () => ({
      leftPanelWidth: clampedPercentage,
      setLeftPanelWidth,
      isResizing,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handleLostPointerCapture,
      nudgeLeftPanelWidth,
      leftPanelRef,
      resizerRef
    }),
    [
      clampedPercentage,
      setLeftPanelWidth,
      isResizing,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handleLostPointerCapture,
      nudgeLeftPanelWidth
    ]
  )
}

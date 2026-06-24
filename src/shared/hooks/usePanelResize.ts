import { PANEL_RESIZING_BODY_CLASS } from '@shared/constants/panelResize'

import {
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { useLocalStorage } from './useLocalStorage'

const DEFAULT_RESIZER_WIDTH = 48
const WIDTH_CHANGE_THRESHOLD = 0.05

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
  handleMouseDown: (e: ReactMouseEvent) => void
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
      // Throttle via requestAnimationFrame to avoid setting state on every
      // pixel of a window resize, which would cascade re-renders through the
      // entire component tree (MainWorkspace → AiWebview → AiSession).
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

  const effectiveResizerWidth = Math.max(28, resizerWidth)
  const maxAvailable = Math.max(0, windowWidth - effectiveResizerWidth)
  const safeMinLeft = Math.min(minLeft, maxAvailable)
  const safeMaxLeft = Math.max(safeMinLeft, windowWidth - minRight - effectiveResizerWidth)

  const desiredWidthPx = (leftPanelWidth / 100) * windowWidth
  const clampedWidthPx = Math.max(safeMinLeft, Math.min(desiredWidthPx, safeMaxLeft))
  const clampedPercentage = windowWidth > 0 ? (clampedWidthPx / windowWidth) * 100 : leftPanelWidth

  const leftPanelRef = useRef<HTMLElement | null>(null)
  const resizerRef = useRef<HTMLElement | null>(null)

  const pendingWidthRef = useRef<number>(clampedPercentage)
  const startWidthRef = useRef<number>(clampedPercentage)

  const isResizingRef = useRef<boolean>(false)

  const rafIdRef = useRef<number | null>(null)

  const leftPanelWidthRef = useRef(clampedPercentage)
  leftPanelWidthRef.current = clampedPercentage

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()

    isResizingRef.current = true

    document.body.classList.add(PANEL_RESIZING_BODY_CLASS)

    setIsResizing(true)

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    if (resizerRef.current) {
      resizerRef.current.classList.add('dragging')
    }

    pendingWidthRef.current = leftPanelWidthRef.current
    startWidthRef.current = leftPanelWidthRef.current
  }, [])

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const updatePanelWidth = (percentage: number) => {
      if (leftPanelRef.current) {
        leftPanelRef.current.style.width = `${percentage}%`
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return

      const containerWidth = window.innerWidth
      const maxAvailableWidth = Math.max(0, containerWidth - effectiveResizerWidth)
      const safeMinLeftVal = Math.min(minLeft, maxAvailableWidth)
      const safeMaxLeftVal = Math.max(
        safeMinLeftVal,
        containerWidth - minRight - effectiveResizerWidth
      )

      let newWidthPx: number

      if (isReversed) {
        newWidthPx = containerWidth - e.clientX - effectiveResizerWidth / 2
      } else {
        newWidthPx = e.clientX
      }

      const clampedWidthPxVal = Math.max(safeMinLeftVal, Math.min(newWidthPx, safeMaxLeftVal))
      const percentage = (clampedWidthPxVal / containerWidth) * 100

      pendingWidthRef.current = percentage

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
      rafIdRef.current = requestAnimationFrame(() => {
        updatePanelWidth(percentage)
      })
    }

    const resizerEl = resizerRef.current

    const handleMouseUp = () => {
      if (!isResizingRef.current) return

      isResizingRef.current = false

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      if (resizerEl) {
        resizerEl.classList.remove('dragging')
      }

      document.body.classList.remove(PANEL_RESIZING_BODY_CLASS)

      const finalWidth = pendingWidthRef.current
      const widthDiff = Math.abs(finalWidth - startWidthRef.current)

      setIsResizing(false)

      if (widthDiff >= WIDTH_CHANGE_THRESHOLD) {
        setLeftPanelWidth(finalWidth)
      }
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }

      if (resizerEl) {
        resizerEl.classList.remove('dragging')
      }

      document.body.classList.remove(PANEL_RESIZING_BODY_CLASS)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, minLeft, minRight, setLeftPanelWidth, isReversed, effectiveResizerWidth])

  return useMemo(
    () => ({
      leftPanelWidth: clampedPercentage,
      setLeftPanelWidth,
      isResizing,
      handleMouseDown,
      leftPanelRef,
      resizerRef
    }),
    [clampedPercentage, setLeftPanelWidth, isResizing, handleMouseDown, leftPanelRef, resizerRef]
  )
}

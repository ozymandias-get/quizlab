import { PANEL_RESIZING_BODY_CLASS } from '@shared/constants/panelResize'

import {
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
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

  const endResize = useCallback(() => {
    if (!isResizingRef.current) return

    isResizingRef.current = false

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    const resizerEl = resizerRef.current
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
  }, [setLeftPanelWidth])

  /**
   * Pointer capture based resize start. Unlike the old document-level
   * mousemove/mouseup listeners, capturing the pointer on the resizer handle
   * means drag events keep streaming to the handle even when the cursor leaves
   * the window (or the iframe boundary) mid-drag. Releasing the capture on
   * pointerup / lostpointercapture guarantees the listeners are torn down even
   * if the component unmounts mid-drag — no stray document listeners are left
   * behind.
   */
  const handlePointerDown = useCallback((e: ReactPointerEvent) => {
    e.preventDefault()

    isResizingRef.current = true

    document.body.classList.add(PANEL_RESIZING_BODY_CLASS)

    setIsResizing(true)

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const resizerEl = resizerRef.current
    if (resizerEl) {
      resizerEl.classList.add('dragging')
    }
    // Capture on the element that received the pointerdown (currentTarget) —
    // that is the same element that owns the pointermove/pointerup handlers.
    // Capturing on the outer resizer wrapper instead would retarget all
    // pointer events away from the handler element, so the drag would never
    // track (and pointerup would never be seen).
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Pointer capture can fail if the element was detached — the drag then
      // degrades to window-level implicit capture behavior.
    }

    pendingWidthRef.current = leftPanelWidthRef.current
    startWidthRef.current = leftPanelWidthRef.current
  }, [])

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
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
        if (leftPanelRef.current) {
          leftPanelRef.current.style.width = `${percentage}%`
        }
      })
    },
    [effectiveResizerWidth, isReversed, minLeft, minRight]
  )

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const resizerEl = resizerRef.current
      try {
        resizerEl?.releasePointerCapture(e.pointerId)
      } catch {
        // Already released or detached — safe to ignore.
      }
      endResize()
    },
    [endResize]
  )

  const handleLostPointerCapture = useCallback(() => {
    // Fired when the browser forcibly drops the capture (alt-tab, devtools,
    // element unmount). Without this the component would stay in a stuck
    // "resizing" state with the body cursor frozen.
    endResize()
  }, [endResize])

  const nudgeLeftPanelWidth = useCallback(
    (deltaPx: number) => {
      const containerWidth = window.innerWidth
      const maxAvailableWidth = Math.max(0, containerWidth - effectiveResizerWidth)
      const safeMinLeftVal = Math.min(minLeft, maxAvailableWidth)
      const safeMaxLeftVal = Math.max(
        safeMinLeftVal,
        containerWidth - minRight - effectiveResizerWidth
      )
      const currentPx = (leftPanelWidthRef.current / 100) * containerWidth
      const nextPx = Math.max(safeMinLeftVal, Math.min(currentPx + deltaPx, safeMaxLeftVal))
      const nextPercentage = containerWidth > 0 ? (nextPx / containerWidth) * 100 : 50
      leftPanelWidthRef.current = nextPercentage
      setLeftPanelWidth(nextPercentage)
    },
    [minLeft, minRight, effectiveResizerWidth, setLeftPanelWidth]
  )

  // Cleanup on unmount: if the component unmounts mid-drag, pointer capture is
  // released by the browser automatically, but the body classes/cursor styles
  // must be reset by us.
  //
  // NOTE: `endResize` gets a new identity whenever `setLeftPanelWidth` does
  // (useLocalStorage recreates its setter when its inline `validate` arrow
  // changes), so it must be read through a ref. Depending on `endResize`
  // directly would re-run this cleanup on EVERY render and cancel an active
  // drag right after it starts.
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

  return {
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
  }
}

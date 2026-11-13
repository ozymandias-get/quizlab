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

import { useLocalStorage } from './useLocalStorage'

/**
 * Panel-resize geometry.
 *
 * This was `constants/panelResize.ts` (the body class) plus
 * `hooks/panelResize/panelResizeUtils.ts` (the bounds arithmetic) — three files
 * and two directories for one hook, where the constants module had exactly one
 * consumer, the utils module, which itself had exactly one consumer, this file.
 * The hook and its arithmetic are now one unit: 293 lines, well inside the
 * 650-line hook limit.
 */
/** Set on `document.body` synchronously while hub/panel drag runs (before React state updates). */
const PANEL_RESIZING_BODY_CLASS = 'panel-resizing'

const DEFAULT_RESIZER_WIDTH = 48
const WIDTH_CHANGE_THRESHOLD = 0.3

function setBodyResizingState(isResizing: boolean) {
  if (typeof document === 'undefined') return
  if (isResizing) {
    document.body.classList.add(PANEL_RESIZING_BODY_CLASS)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  } else {
    document.body.classList.remove(PANEL_RESIZING_BODY_CLASS)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
}

function calculatePanelBounds(
  containerWidth: number,
  resizerWidth: number,
  minLeft: number,
  minRight: number
) {
  const effectiveResizerWidth = Math.max(28, resizerWidth)
  const maxAvailable = Math.max(0, containerWidth - effectiveResizerWidth)
  const safeMinLeft = Math.min(minLeft, maxAvailable)
  const safeMaxLeft = Math.max(safeMinLeft, containerWidth - minRight - effectiveResizerWidth)
  return { effectiveResizerWidth, safeMinLeft, safeMaxLeft }
}

function clampPanelPercentage(
  currentPercentage: number,
  containerWidth: number,
  safeMinLeft: number,
  safeMaxLeft: number
): number {
  const desiredWidthPx = (currentPercentage / 100) * containerWidth
  const clampedWidthPx = Math.max(safeMinLeft, Math.min(desiredWidthPx, safeMaxLeft))
  return containerWidth > 0 ? (clampedWidthPx / containerWidth) * 100 : currentPercentage
}

interface PanelContainerRect {
  left: number
  right: number
  width: number
}

/**
 * The panels are sized as a percentage of the flex container's *content box*,
 * while pointer coordinates are viewport-relative. Measuring the parent (and
 * removing its horizontal padding) keeps min-width clamps and drag deltas in
 * the same coordinate space; using `window.innerWidth` made the outer gutter
 * count as panel width, so a 300px minimum rendered as ~290px.
 */
function measurePanelContainer(leftPanel: HTMLElement | null): PanelContainerRect | null {
  const parent = leftPanel?.parentElement
  if (!parent || typeof window === 'undefined') return null

  const rect = parent.getBoundingClientRect()
  const style = window.getComputedStyle(parent)
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0
  const paddingRight = Number.parseFloat(style.paddingRight) || 0
  const width = Math.max(0, rect.width - paddingLeft - paddingRight)

  return {
    left: rect.left + paddingLeft,
    right: rect.right - paddingRight,
    width
  }
}

function getPanelContainerWidth(leftPanel: HTMLElement | null): number {
  const measured = measurePanelContainer(leftPanel)
  if (measured) return measured.width
  return typeof window !== 'undefined' ? window.innerWidth : 1200
}

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
  const leftPanelRef = useRef<HTMLElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    let rafId: number | null = null
    const updateContainerWidth = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        const nextWidth = getPanelContainerWidth(leftPanelRef.current)
        setContainerWidth((previous) =>
          Math.abs(previous - nextWidth) < 0.5 ? previous : nextWidth
        )
      })
    }

    updateContainerWidth()
    window.addEventListener('resize', updateContainerWidth)

    const parent = leftPanelRef.current?.parentElement
    const observer =
      parent && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateContainerWidth)
        : null
    if (parent && observer) observer.observe(parent)

    return () => {
      window.removeEventListener('resize', updateContainerWidth)
      observer?.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  const { effectiveResizerWidth, safeMinLeft, safeMaxLeft } = calculatePanelBounds(
    containerWidth,
    resizerWidth,
    minLeft,
    minRight
  )

  const clampedPercentage = clampPanelPercentage(
    leftPanelWidth,
    containerWidth,
    safeMinLeft,
    safeMaxLeft
  )

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

    if (widthDiff + Number.EPSILON >= WIDTH_CHANGE_THRESHOLD) {
      setLeftPanelWidth(finalWidth)
    } else {
      // Snap visual width back to the committed value to avoid DOM/style desync
      // when the drag was below threshold (pendingWidth was rendered via direct
      // style.width but not persisted).
      if (leftPanelRef.current) {
        leftPanelRef.current.style.width = `${leftPanelWidthRef.current}%`
      }
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

      const container =
        measurePanelContainer(leftPanelRef.current) ??
        ({
          left: 0,
          right: window.innerWidth,
          width: window.innerWidth
        } satisfies PanelContainerRect)
      const bounds = calculatePanelBounds(container.width, effectiveResizerWidth, minLeft, minRight)
      // The drag handle is centred on the divider. Subtracting half of its
      // width turns the pointer position into the panel edge, so grabbing the
      // handle does not jump the panel by ~24px on the first move (the
      // reversed branch already did this).
      const newWidthPx = isReversed
        ? container.right - e.clientX - effectiveResizerWidth / 2
        : e.clientX - container.left - effectiveResizerWidth / 2

      const clampedWidthPxVal = Math.max(
        bounds.safeMinLeft,
        Math.min(newWidthPx, bounds.safeMaxLeft)
      )
      const percentage = container.width > 0 ? (clampedWidthPxVal / container.width) * 100 : 50
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
      const currentContainerWidth = getPanelContainerWidth(leftPanelRef.current)
      const bounds = calculatePanelBounds(
        currentContainerWidth,
        effectiveResizerWidth,
        minLeft,
        minRight
      )
      const currentPx = (leftPanelWidthRef.current / 100) * currentContainerWidth
      const nextPx = Math.max(bounds.safeMinLeft, Math.min(currentPx + deltaPx, bounds.safeMaxLeft))
      const nextPercentage = currentContainerWidth > 0 ? (nextPx / currentContainerWidth) * 100 : 50
      const diff = Math.abs(nextPercentage - leftPanelWidthRef.current)
      if (diff + Number.EPSILON < WIDTH_CHANGE_THRESHOLD) return
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

  /**
   * Window-level safety net for a drag React never got to hear about.
   *
   * `endResize` is otherwise only reachable from React's `onPointerUp` /
   * `onLostPointerCapture` on the drag area, and neither is guaranteed: a
   * pointer cancelled by the browser (a competing drag, a context menu, a
   * devtools gesture), released while focus sat in another window, or lost
   * because the captured element went away mid-drag all end the gesture without
   * a React event. A missed end is not cosmetic — it leaves `isResizing` true,
   * which is what pins `pointer-events: none` onto the AI panel and keeps
   * `cursor: col-resize` / `user-select: none` on the body.
   *
   * Window-level rather than on the drag area on purpose: the panel it resizes
   * is, during the drag, being covered by a `WebContentsView` composited above
   * the DOM, and a native view swallows the pointer events aimed at anything
   * beneath it. These listeners are also idempotent against the React ones —
   * `endResize` returns immediately once `isResizingRef` is false.
   */
  useEffect(() => {
    const endIfResizing = () => {
      if (isResizingRef.current) endResizeRef.current()
    }

    window.addEventListener('pointerup', endIfResizing)
    window.addEventListener('pointercancel', endIfResizing)
    window.addEventListener('blur', endIfResizing)

    return () => {
      window.removeEventListener('pointerup', endIfResizing)
      window.removeEventListener('pointercancel', endIfResizing)
      window.removeEventListener('blur', endIfResizing)
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

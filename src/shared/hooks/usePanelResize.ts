import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SetStateAction
} from 'react'
import { PANEL_RESIZING_BODY_CLASS } from '@shared/constants/panelResize'
import { useLocalStorage } from './useLocalStorage'

const DEFAULT_RESIZER_WIDTH = 48

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

  const leftPanelRef = useRef<HTMLElement | null>(null)
  const resizerRef = useRef<HTMLElement | null>(null)

  const pendingWidthRef = useRef<number>(leftPanelWidth)

  const isResizingRef = useRef<boolean>(false)

  const rafIdRef = useRef<number | null>(null)

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault()

      isResizingRef.current = true

      document.body.classList.add(PANEL_RESIZING_BODY_CLASS)

      setIsResizing(true)

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      if (resizerRef.current) {
        resizerRef.current.classList.add('dragging')
      }

      pendingWidthRef.current = leftPanelWidth
    },
    [leftPanelWidth]
  )

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const effectiveResizerWidth = Math.max(28, resizerWidth)

    const updatePanelWidth = (percentage: number) => {
      if (leftPanelRef.current) {
        leftPanelRef.current.style.width = `${percentage}%`
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return

      const containerWidth = window.innerWidth
      let newWidthPx: number

      if (isReversed) {
        newWidthPx = containerWidth - e.clientX - effectiveResizerWidth / 2
      } else {
        newWidthPx = e.clientX
      }

      const maxAllowedWidth = containerWidth - minRight - effectiveResizerWidth

      if (newWidthPx >= minLeft && newWidthPx <= maxAllowedWidth) {
        const percentage = (newWidthPx / containerWidth) * 100

        pendingWidthRef.current = percentage

        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current)
        }
        rafIdRef.current = requestAnimationFrame(() => {
          updatePanelWidth(percentage)
        })
      }
    }

    const handleMouseUp = () => {
      if (!isResizingRef.current) return

      isResizingRef.current = false

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      if (resizerRef.current) {
        resizerRef.current.classList.remove('dragging')
      }

      document.body.classList.remove(PANEL_RESIZING_BODY_CLASS)

      setIsResizing(false)

      setLeftPanelWidth(pendingWidthRef.current)
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }

      if (resizerRef.current) {
        resizerRef.current.classList.remove('dragging')
      }

      document.body.classList.remove(PANEL_RESIZING_BODY_CLASS)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, minLeft, minRight, setLeftPanelWidth, isReversed, resizerWidth])

  return {
    leftPanelWidth,
    setLeftPanelWidth,
    isResizing,
    handleMouseDown,
    leftPanelRef,
    resizerRef
  }
}

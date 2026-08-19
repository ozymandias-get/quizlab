import { type PointerEvent, type RefObject, useCallback, useMemo, useRef } from 'react'

import { createResizeKeyDownHandler } from './createResizeKeyDownHandler'
import {
  clamp,
  clampLayout,
  MAX_HEIGHT,
  MAX_WIDTH,
  MIN_HEIGHT,
  MIN_WIDTH,
  type ResizeState,
  saveLayoutToStorage
} from './layoutUtils'
import type { DockLayout, ResizeDirection } from './types'

interface UseComposerResizeInteractionOptions {
  asideRef: RefObject<HTMLElement | null>
  layoutRef: RefObject<DockLayout>
  setLayout: (value: DockLayout | ((prev: DockLayout) => DockLayout)) => void
  hasUserMovedRef: RefObject<boolean>
}

export function useComposerResizeInteraction({
  asideRef,
  layoutRef,
  setLayout,
  hasUserMovedRef
}: UseComposerResizeInteractionOptions) {
  const resizeStateRef = useRef<ResizeState | null>(null)

  const getResizeCursor = useCallback((dir: ResizeDirection) => {
    const cursors: Record<ResizeDirection, string> = {
      n: 'ns-resize',
      s: 'ns-resize',
      e: 'ew-resize',
      w: 'ew-resize',
      ne: 'nesw-resize',
      nw: 'nwse-resize',
      se: 'nwse-resize',
      sw: 'nesw-resize'
    }
    return cursors[dir]
  }, [])

  const handleResizeStart = useCallback(
    (direction: ResizeDirection) => (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      resizeStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startLayout: { ...layoutRef.current },
        direction
      }
      asideRef.current?.style.setProperty('transition', 'none')
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [asideRef, layoutRef]
  )

  const handleResizeMove = useCallback(
    (event: React.PointerEvent) => {
      const state = resizeStateRef.current
      if (!state) return
      event.preventDefault()

      const dx = event.clientX - state.startX
      const dy = event.clientY - state.startY
      const s = state.startLayout
      const dir = state.direction

      let newX = s.x,
        newY = s.y,
        newW = s.width,
        newH = s.height

      if (dir.includes('e')) newW = clamp(s.width + dx, MIN_WIDTH, MAX_WIDTH)
      if (dir.includes('w')) {
        newW = clamp(s.width - dx, MIN_WIDTH, MAX_WIDTH)
        newX = s.x + (s.width - newW)
      }
      if (dir.includes('s')) newH = clamp(s.height + dy, MIN_HEIGHT, MAX_HEIGHT)
      if (dir.includes('n')) {
        newH = clamp(s.height - dy, MIN_HEIGHT, MAX_HEIGHT)
        newY = s.y + (s.height - newH)
      }

      const el = asideRef.current
      if (el) {
        el.style.left = `${newX}px`
        el.style.top = `${newY}px`
        el.style.width = `${newW}px`
        el.style.height = `${newH}px`
      }
    },
    [asideRef]
  )

  const handleResizeEnd = useCallback(
    (event: React.PointerEvent) => {
      const state = resizeStateRef.current
      if (!state) return
      hasUserMovedRef.current = true

      const dx = event.clientX - state.startX
      const dy = event.clientY - state.startY
      const s = state.startLayout
      const dir = state.direction

      let newX = s.x,
        newY = s.y,
        newW = s.width,
        newH = s.height

      if (dir.includes('e')) newW = clamp(s.width + dx, MIN_WIDTH, MAX_WIDTH)
      if (dir.includes('w')) {
        newW = clamp(s.width - dx, MIN_WIDTH, MAX_WIDTH)
        newX = s.x + (s.width - newW)
      }
      if (dir.includes('s')) newH = clamp(s.height + dy, MIN_HEIGHT, MAX_HEIGHT)
      if (dir.includes('n')) {
        newH = clamp(s.height - dy, MIN_HEIGHT, MAX_HEIGHT)
        newY = s.y + (s.height - newH)
      }

      const finalLayout = clampLayout({ x: newX, y: newY, width: newW, height: newH })
      setLayout(finalLayout)
      saveLayoutToStorage(finalLayout)

      const el = asideRef.current
      if (el) {
        el.style.removeProperty('transition')
      }
      resizeStateRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    [asideRef, hasUserMovedRef, setLayout]
  )

  const handleResizeLostCapture = useCallback(() => {
    if (!resizeStateRef.current) return
    const { startLayout } = resizeStateRef.current
    const el = asideRef.current
    if (el) {
      el.style.left = `${startLayout.x}px`
      el.style.top = `${startLayout.y}px`
      el.style.width = `${startLayout.width}px`
      el.style.height = `${startLayout.height}px`
      el.style.removeProperty('transition')
    }
    resizeStateRef.current = null
  }, [asideRef])

  const handleResizeKeyDown = useMemo(
    () =>
      createResizeKeyDownHandler({
        getLayout: () => layoutRef.current,
        setLayout: (next) => {
          setLayout(next)
        }
      }),
    [layoutRef, setLayout]
  )

  const resizeHandlers = useMemo(
    () => ({
      onResizeMove: handleResizeMove,
      onResizeEnd: handleResizeEnd,
      onResizeLostCapture: handleResizeLostCapture
    }),
    [handleResizeMove, handleResizeEnd, handleResizeLostCapture]
  )

  return {
    handleResizeStart,
    handleResizeKeyDown,
    getResizeCursor,
    resizeHandlers,
    handleResizeLostCapture
  }
}

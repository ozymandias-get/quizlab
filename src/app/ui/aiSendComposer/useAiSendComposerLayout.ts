import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { DragState, ResizeState } from './layoutUtils'
import {
  clamp,
  clampLayout,
  COMPACT_HEIGHT,
  EDGE_THICKNESS,
  HEADER_RESERVED_HEIGHT,
  loadStoredLayout,
  MAX_HEIGHT,
  MAX_WIDTH,
  MIN_BODY_HEIGHT,
  MIN_HEIGHT,
  MIN_WIDTH,
  saveLayoutToStorage
} from './layoutUtils'
import type { DockLayout, ResizeDirection } from './types'

export function useAiSendComposerLayout(isExpanded: boolean) {
  const [layout, setLayout] = useState<DockLayout>(loadStoredLayout)
  const panelRef = useRef<HTMLDivElement>(null)
  const asideRef = useRef<HTMLElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const resizeStateRef = useRef<ResizeState | null>(null)
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => setLayout((c) => clampLayout(c))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const applyPosition = useCallback((x: number, y: number) => {
    const el = asideRef.current
    if (!el) return
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }, [])

  const handleDragStart = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button, textarea, input, img, [data-resize]')) return

    event.preventDefault()
    const el = asideRef.current
    const rect = el?.getBoundingClientRect()
    dragStateRef.current = {
      offsetX: event.clientX - (rect?.left ?? layoutRef.current.x),
      offsetY: event.clientY - (rect?.top ?? layoutRef.current.y)
    }
    el?.style.setProperty('transition', 'none')
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const handleDragMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current) return
      event.preventDefault()
      applyPosition(
        event.clientX - dragStateRef.current.offsetX,
        event.clientY - dragStateRef.current.offsetY
      )
    },
    [applyPosition]
  )

  const handleDragEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return
    const newX = event.clientX - dragStateRef.current.offsetX
    const newY = event.clientY - dragStateRef.current.offsetY
    const finalLayout = clampLayout({ ...layoutRef.current, x: newX, y: newY })
    setLayout(finalLayout)
    saveLayoutToStorage(finalLayout)
    asideRef.current?.style.removeProperty('transition')
    dragStateRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

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
    []
  )

  const handleResizeMove = useCallback((event: React.PointerEvent) => {
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
  }, [])

  const handleResizeEnd = useCallback((event: React.PointerEvent) => {
    const state = resizeStateRef.current
    if (!state) return

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
  }, [])

  const effectiveHeight = isExpanded ? layout.height : COMPACT_HEIGHT
  const bodyHeight = Math.max(MIN_BODY_HEIGHT, layout.height - HEADER_RESERVED_HEIGHT)

  // Memoize the derived layout so we don't create a new spread-object on
  // every parent re-render. The layout state only changes on resize/drag-end,
  // and effectiveHeight only changes with isExpanded toggle.
  const derivedLayout = useMemo(
    () => ({ ...layout, height: effectiveHeight }),
    [layout, effectiveHeight]
  )

  // Stable handler bundle so `AiSendComposerContent`'s `memo()` can actually
  // bail out. Without `useMemo`, the parent re-renders a new object every
  // time the dock resizes, which makes the memo useless and re-renders all
  // 8 resize edges + the entire queue + footer + send-mode bar on every tick.
  // Both inner functions are stable (empty deps), so we can memoize once.
  const resizeHandlers = useMemo(
    () => ({ onResizeMove: handleResizeMove, onResizeEnd: handleResizeEnd }),
    [handleResizeMove, handleResizeEnd]
  )

  return useMemo(
    () => ({
      layout: derivedLayout,
      bodyHeight,
      panelRef,
      asideRef,
      handleDragStart,
      handleDragMove,
      handleDragEnd,
      handleResizeStart,
      getResizeCursor,
      resizeHandlers,
      edgeThickness: EDGE_THICKNESS
    }),
    [
      derivedLayout,
      bodyHeight,
      panelRef,
      asideRef,
      handleDragStart,
      handleDragMove,
      handleDragEnd,
      handleResizeStart,
      getResizeCursor,
      resizeHandlers
    ]
  )
}

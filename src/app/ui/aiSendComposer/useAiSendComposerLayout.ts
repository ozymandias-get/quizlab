import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { DragState } from './layoutUtils'
import {
  clamp,
  clampLayout,
  COMPACT_HEIGHT,
  COMPACT_WIDTH,
  EDGE_THICKNESS,
  HEADER_RESERVED_HEIGHT,
  loadStoredLayout,
  MIN_BODY_HEIGHT,
  saveLayoutToStorage,
  VIEWPORT_PADDING
} from './layoutUtils'
import type { DockLayout } from './types'
import { useComposerResizeInteraction } from './useComposerResizeInteraction'

export function useAiSendComposerLayout(
  isExpanded: boolean,
  anchorPosition?: { top: number; left: number } | null
) {
  const [layout, setLayout] = useState<DockLayout>(() => {
    const base = loadStoredLayout()
    if (anchorPosition) {
      return clampLayout({
        ...base,
        x: anchorPosition.left - base.width / 2,
        y: anchorPosition.top
      })
    }
    return base
  })
  const panelRef = useRef<HTMLDivElement>(null)
  const asideRef = useRef<HTMLElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const lastAnchorRef = useRef<string | null>(null)
  const hasUserMovedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => setLayout((c) => clampLayout(c))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!anchorPosition) return
    const key = `${anchorPosition.left},${anchorPosition.top}`
    if (lastAnchorRef.current === key) return
    lastAnchorRef.current = key
    hasUserMovedRef.current = false

    setLayout((prev) => {
      const targetX = anchorPosition.left - prev.width / 2
      const targetY = anchorPosition.top
      return clampLayout({
        ...prev,
        x: targetX,
        y: targetY
      })
    })
  }, [anchorPosition])

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
    hasUserMovedRef.current = true
    const newX = event.clientX - dragStateRef.current.offsetX
    const newY = event.clientY - dragStateRef.current.offsetY
    const finalLayout = clampLayout({ ...layoutRef.current, x: newX, y: newY })
    setLayout(finalLayout)
    saveLayoutToStorage(finalLayout)
    asideRef.current?.style.removeProperty('transition')
    dragStateRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const handleDragLostCapture = useCallback(() => {
    if (!dragStateRef.current) return
    applyPosition(layoutRef.current.x, layoutRef.current.y)
    asideRef.current?.style.removeProperty('transition')
    dragStateRef.current = null
  }, [applyPosition])

  const {
    handleResizeStart,
    handleResizeKeyDown,
    getResizeCursor,
    resizeHandlers,
    handleResizeLostCapture
  } = useComposerResizeInteraction({
    asideRef,
    layoutRef,
    setLayout,
    hasUserMovedRef
  })

  const compactWidth =
    typeof window !== 'undefined'
      ? Math.min(COMPACT_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2)
      : COMPACT_WIDTH

  const effectiveWidth = isExpanded ? layout.width : compactWidth
  const effectiveHeight = isExpanded ? layout.height : COMPACT_HEIGHT
  const bodyHeight = Math.max(MIN_BODY_HEIGHT, layout.height - HEADER_RESERVED_HEIGHT)

  const effectiveX = useMemo(() => {
    if (!hasUserMovedRef.current && anchorPosition) {
      const targetX = anchorPosition.left - effectiveWidth / 2
      const maxX =
        typeof window !== 'undefined'
          ? Math.max(VIEWPORT_PADDING, window.innerWidth - effectiveWidth - VIEWPORT_PADDING)
          : targetX
      return clamp(targetX, VIEWPORT_PADDING, maxX)
    }
    return layout.x
  }, [anchorPosition, effectiveWidth, layout.x])

  const effectiveY = useMemo(() => {
    if (!hasUserMovedRef.current && anchorPosition) {
      const targetY = anchorPosition.top
      const maxY =
        typeof window !== 'undefined'
          ? Math.max(VIEWPORT_PADDING, window.innerHeight - effectiveHeight - VIEWPORT_PADDING)
          : targetY
      return clamp(targetY, VIEWPORT_PADDING, maxY)
    }
    return layout.y
  }, [anchorPosition, effectiveHeight, layout.y])

  const derivedLayout = useMemo(
    () => ({
      ...layout,
      x: effectiveX,
      y: effectiveY,
      width: effectiveWidth,
      height: effectiveHeight
    }),
    [layout, effectiveX, effectiveY, effectiveWidth, effectiveHeight]
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
      handleDragLostCapture,
      handleResizeStart,
      handleResizeKeyDown,
      getResizeCursor,
      resizeHandlers,
      handleResizeLostCapture,
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
      handleDragLostCapture,
      handleResizeStart,
      handleResizeKeyDown,
      getResizeCursor,
      resizeHandlers,
      handleResizeLostCapture
    ]
  )
}

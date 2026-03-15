import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '@shared/hooks'
import type { DockLayout } from './types'

const STORAGE_KEY = 'aiSendDockLayout'
const DEFAULT_LAYOUT: DockLayout = {
  x: 28,
  y: 0,
  width: 356,
  height: 332
}
const MIN_WIDTH = 312
const MAX_WIDTH = 560
const MIN_HEIGHT = 260
const MAX_HEIGHT = 640
const BOTTOM_OFFSET = 92
const VIEWPORT_PADDING = 0

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function clampLayout(layout: DockLayout, panelHeight = layout.height): DockLayout {
  if (typeof window === 'undefined') {
    return layout
  }

  const width = clamp(
    layout.width,
    MIN_WIDTH,
    Math.min(MAX_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2)
  )
  const height = clamp(
    layout.height,
    MIN_HEIGHT,
    Math.min(MAX_HEIGHT, window.innerHeight - VIEWPORT_PADDING * 2)
  )
  const visibleHeight = Math.max(panelHeight, 0)
  const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING)
  const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - visibleHeight - VIEWPORT_PADDING)

  return {
    x: clamp(layout.x, VIEWPORT_PADDING, maxX),
    y: clamp(layout.y, VIEWPORT_PADDING, maxY),
    width,
    height
  }
}

function createDefaultLayout(): DockLayout {
  if (typeof window === 'undefined') {
    return DEFAULT_LAYOUT
  }

  return clampLayout({
    ...DEFAULT_LAYOUT,
    y: window.innerHeight - DEFAULT_LAYOUT.height - BOTTOM_OFFSET
  })
}

export function useAiSendComposerLayout(itemsLength: number) {
  const [layout, setLayout] = useLocalStorage<DockLayout>(STORAGE_KEY, createDefaultLayout())
  const [isDragging, setIsDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const resizeStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startWidth: number
    startHeight: number
  } | null>(null)

  const getPanelHeight = useCallback(() => {
    return panelRef.current?.getBoundingClientRect().height ?? layout.height
  }, [layout.height])

  useEffect(() => {
    setLayout((current) => clampLayout(current, getPanelHeight()))
  }, [getPanelHeight, itemsLength, setLayout])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      setLayout((current) => clampLayout(current, getPanelHeight()))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [getPanelHeight, setLayout])

  useEffect(() => {
    const panelElement = panelRef.current
    if (!panelElement || typeof ResizeObserver === 'undefined') {
      return
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries
      if (!entry) {
        return
      }

      setLayout((current) => clampLayout(current, entry.contentRect.height))
    })

    resizeObserver.observe(panelElement)
    return () => resizeObserver.disconnect()
  }, [setLayout])

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      if (target.closest('button, textarea, input, img')) {
        return
      }

      event.preventDefault()
      setIsDragging(true)
      dragStateRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - layout.x,
        offsetY: event.clientY - layout.y
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [layout.x, layout.y]
  )

  const handleDragMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
        return
      }

      event.preventDefault()
      setLayout(
        clampLayout(
          {
            ...layout,
            x: event.clientX - dragStateRef.current.offsetX,
            y: event.clientY - dragStateRef.current.offsetY
          },
          getPanelHeight()
        )
      )
    },
    [getPanelHeight, layout, setLayout]
  )

  const handleDragEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
      return
    }

    dragStateRef.current = null
    setIsDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      resizeStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: layout.width,
        startHeight: layout.height
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      event.stopPropagation()
    },
    [layout.height, layout.width]
  )

  const handleResizeMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!resizeStateRef.current || resizeStateRef.current.pointerId !== event.pointerId) {
        return
      }

      const width =
        resizeStateRef.current.startWidth + (event.clientX - resizeStateRef.current.startX)
      const height =
        resizeStateRef.current.startHeight + (event.clientY - resizeStateRef.current.startY)

      setLayout((current) =>
        clampLayout(
          {
            ...current,
            width,
            height
          },
          getPanelHeight()
        )
      )
      event.stopPropagation()
    },
    [getPanelHeight, setLayout]
  )

  const handleResizeEnd = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!resizeStateRef.current || resizeStateRef.current.pointerId !== event.pointerId) {
      return
    }

    resizeStateRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    event.stopPropagation()
  }, [])

  return {
    layout,
    isDragging,
    bodyHeight: Math.max(96, layout.height - 210),
    panelRef,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd
  }
}

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import type { DockLayout } from './types'

const STORAGE_KEY = 'aiSendDockLayout'
const DEFAULT_LAYOUT: DockLayout = {
  x: 28,
  y: 0,
  width: 280,
  height: 260
}
const MIN_WIDTH = 260
const MAX_WIDTH = 480
const MIN_HEIGHT = 200
const MAX_HEIGHT = 520
const BOTTOM_OFFSET = 92
const VIEWPORT_PADDING = 0

const COMPACT_HEIGHT = 56

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

function loadStoredLayout(): DockLayout {
  if (typeof window === 'undefined') return createDefaultLayout()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DockLayout
      if (
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        typeof parsed.width === 'number' &&
        typeof parsed.height === 'number'
      ) {
        return clampLayout(parsed)
      }
    }
  } catch {
    // ignore
  }
  return createDefaultLayout()
}

function saveLayoutToStorage(layout: DockLayout) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // ignore
  }
}

export function useAiSendComposerLayout(_itemsLength: number, isExpanded: boolean) {
  const [layout, setLayout] = useState<DockLayout>(loadStoredLayout)
  const panelRef = useRef<HTMLDivElement>(null)
  const asideRef = useRef<HTMLElement | null>(null)
  const dragStateRef = useRef<{ offsetX: number; offsetY: number } | null>(null)
  const resizeStateRef = useRef<{
    startX: number
    startY: number
    startWidth: number
    startHeight: number
  } | null>(null)
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  const getPanelHeight = useCallback(() => {
    return panelRef.current?.getBoundingClientRect().height ?? layoutRef.current.height
  }, [])

  useEffect(() => {
    setLayout((current) => clampLayout(current, getPanelHeight()))
  }, [getPanelHeight])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      setLayout((current) => clampLayout(current, getPanelHeight()))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [getPanelHeight])

  useEffect(() => {
    const panelElement = panelRef.current
    if (!panelElement || typeof ResizeObserver === 'undefined') {
      return
    }

    let resizeObserverTimer: ReturnType<typeof setTimeout> | null = null
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries
      if (!entry) return

      if (resizeObserverTimer) clearTimeout(resizeObserverTimer)
      resizeObserverTimer = setTimeout(() => {
        setLayout((current) => clampLayout(current, entry.contentRect.height))
      }, 50)
    })

    resizeObserver.observe(panelElement)
    return () => {
      resizeObserver.disconnect()
      if (resizeObserverTimer) clearTimeout(resizeObserverTimer)
    }
  }, [])

  const applyDirectPosition = useCallback((x: number, y: number) => {
    const el = asideRef.current
    if (!el) return
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }, [])

  const handleDragStart = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      if (target.closest('button, textarea, input, img')) {
        return
      }

      event.preventDefault()

      const el = asideRef.current
      const rect = el?.getBoundingClientRect()
      const currentX = rect?.left ?? layout.x
      const currentY = rect?.top ?? layout.y

      dragStateRef.current = {
        offsetX: event.clientX - currentX,
        offsetY: event.clientY - currentY
      }

      if (el) {
        el.style.transition = 'none'
      }

      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [layout.x, layout.y]
  )

  const handleDragMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current) return

      event.preventDefault()

      const newX = event.clientX - dragStateRef.current.offsetX
      const newY = event.clientY - dragStateRef.current.offsetY

      applyDirectPosition(newX, newY)
    },
    [applyDirectPosition]
  )

  const handleDragEnd = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current) return

      const newX = event.clientX - dragStateRef.current.offsetX
      const newY = event.clientY - dragStateRef.current.offsetY

      const panelHeight = getPanelHeight()
      const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - layout.width - VIEWPORT_PADDING)
      const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - panelHeight - VIEWPORT_PADDING)

      const finalLayout = clampLayout(
        {
          x: clamp(newX, VIEWPORT_PADDING, maxX),
          y: clamp(newY, VIEWPORT_PADDING, maxY),
          width: layout.width,
          height: layout.height
        },
        panelHeight
      )

      setLayout(finalLayout)
      saveLayoutToStorage(finalLayout)

      if (asideRef.current) {
        asideRef.current.style.transition = ''
      }

      dragStateRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    [layout.width, layout.height, getPanelHeight]
  )

  const handleResizeStart = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      resizeStateRef.current = {
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

  const handleResizeMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (!resizeStateRef.current) return

    const width = clamp(
      resizeStateRef.current.startWidth + (event.clientX - resizeStateRef.current.startX),
      MIN_WIDTH,
      MAX_WIDTH
    )
    const height = clamp(
      resizeStateRef.current.startHeight + (event.clientY - resizeStateRef.current.startY),
      MIN_HEIGHT,
      MAX_HEIGHT
    )

    const el = panelRef.current
    if (el) {
      el.style.width = `${width}px`
      el.style.height = `${height}px`
    }

    event.stopPropagation()
  }, [])

  const handleResizeEnd = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!resizeStateRef.current) return

      const width = clamp(
        resizeStateRef.current.startWidth + (event.clientX - resizeStateRef.current.startX),
        MIN_WIDTH,
        MAX_WIDTH
      )
      const height = clamp(
        resizeStateRef.current.startHeight + (event.clientY - resizeStateRef.current.startY),
        MIN_HEIGHT,
        MAX_HEIGHT
      )

      const finalLayout = clampLayout({ x: layout.x, y: layout.y, width, height })
      setLayout(finalLayout)
      saveLayoutToStorage(finalLayout)

      if (panelRef.current) {
        panelRef.current.style.width = ''
        panelRef.current.style.height = ''
      }

      resizeStateRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
      event.stopPropagation()
    },
    [layout.x, layout.y]
  )

  const effectiveHeight = isExpanded ? layout.height : COMPACT_HEIGHT
  const bodyHeight = Math.max(100, layout.height - 180)

  return {
    layout: { ...layout, height: effectiveHeight },
    bodyHeight,
    panelRef,
    asideRef,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd
  }
}

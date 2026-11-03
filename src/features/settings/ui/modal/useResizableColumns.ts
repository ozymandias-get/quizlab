import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_WIDTH = 190
const MAX_WIDTH = 380
/** Space the settings content needs before the sidebar is allowed to grow. */
const MIN_CONTENT_WIDTH = 340
/**
 * Below this container width the full sidebar cannot coexist with the content
 * minimum (190 + 340). Switch to an icon rail so the content keeps its width.
 */
const COMPACT_BREAKPOINT = MIN_WIDTH + MIN_CONTENT_WIDTH
const COMPACT_WIDTH = 56

function maxSidebarWidthFor(containerWidth: number): number {
  if (containerWidth <= 0) return MAX_WIDTH
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, containerWidth - MIN_CONTENT_WIDTH))
}

/**
 * Resizable settings sidebar.
 *
 * The absolute bounds alone are not enough: in a narrow window a 380px sidebar
 * would eat the content area. `containerRef` points at the modal's layout row,
 * and the upper bound is derived from its real width (plus a ResizeObserver so
 * shrinking the window clamps an already-wide sidebar).
 */
export function useResizableColumns(initialSidebar = 240) {
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebar)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const clampToContainer = useCallback(() => {
    const width = containerRef.current?.clientWidth ?? 0
    setContainerWidth(width)
    const max = maxSidebarWidthFor(width)
    setSidebarWidth((prev) => Math.min(max, Math.max(MIN_WIDTH, prev)))
  }, [])

  useEffect(() => {
    clampToContainer()
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => clampToContainer())
    observer.observe(container)
    return () => observer.disconnect()
  }, [clampToContainer])

  const handleSidebarResize = useCallback((delta: number) => {
    const width = containerRef.current?.clientWidth ?? 0
    setContainerWidth(width)
    if (width > 0 && width < COMPACT_BREAKPOINT) return

    const max = maxSidebarWidthFor(width)
    setSidebarWidth((prev) => Math.min(max, Math.max(MIN_WIDTH, prev + delta)))
  }, [])

  const isCompact = containerWidth > 0 && containerWidth < COMPACT_BREAKPOINT

  return {
    sidebarWidth: isCompact ? COMPACT_WIDTH : sidebarWidth,
    handleSidebarResize,
    containerRef,
    isCompact
  }
}

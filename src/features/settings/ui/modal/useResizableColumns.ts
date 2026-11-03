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
/**
 * Enter compact below the breakpoint, leave it only a little above. Without
 * this gap a window parked exactly on the threshold would flip between the
 * 56px rail and the full sidebar on every minor layout change.
 */
const COMPACT_EXIT_MARGIN = 24

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
  const [isCompact, setIsCompact] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isCompactRef = useRef(false)

  const applyContainerWidth = useCallback((width: number) => {
    // Hysteresis: compact is entered below the breakpoint but only left once
    // the container is comfortably wide again.
    const shouldBeCompact = isCompactRef.current
      ? width < COMPACT_BREAKPOINT + COMPACT_EXIT_MARGIN
      : width < COMPACT_BREAKPOINT

    if (width > 0 && shouldBeCompact !== isCompactRef.current) {
      isCompactRef.current = shouldBeCompact
      setIsCompact(shouldBeCompact)
    }

    return width
  }, [])

  const clampToContainer = useCallback(() => {
    const width = applyContainerWidth(containerRef.current?.clientWidth ?? 0)
    const max = maxSidebarWidthFor(width)
    setSidebarWidth((prev) => Math.min(max, Math.max(MIN_WIDTH, prev)))
  }, [applyContainerWidth])

  useEffect(() => {
    clampToContainer()
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => clampToContainer())
    observer.observe(container)
    return () => observer.disconnect()
  }, [clampToContainer])

  const handleSidebarResize = useCallback(
    (delta: number) => {
      const width = applyContainerWidth(containerRef.current?.clientWidth ?? 0)
      if (isCompactRef.current) return

      const max = maxSidebarWidthFor(width)
      setSidebarWidth((prev) => Math.min(max, Math.max(MIN_WIDTH, prev + delta)))
    },
    [applyContainerWidth]
  )

  return {
    sidebarWidth: isCompact ? COMPACT_WIDTH : sidebarWidth,
    handleSidebarResize,
    containerRef,
    isCompact
  }
}

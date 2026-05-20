/**
 * PDF context menu hook — captures right-click events on the PDF container
 * and provides position state for the context menu component.
 */
import { useState, useEffect, type RefObject } from 'react'

interface ContextMenuPosition {
  x: number
  y: number
}

export function usePdfContextMenu(containerRef: RefObject<HTMLElement | null>) {
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY })
    }

    el.addEventListener('contextmenu', handleContextMenu)

    return () => {
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [containerRef])

  return { contextMenu, setContextMenu }
}

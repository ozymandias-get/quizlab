import { useState, useEffect, type RefObject } from 'react'

export function usePdfContextMenu(containerRef: RefObject<HTMLElement | null>) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY })
    }

    el.addEventListener('contextmenu', handleContextMenu)

    return () => {
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [containerRef])

  return {
    contextMenu,
    setContextMenu
  }
}

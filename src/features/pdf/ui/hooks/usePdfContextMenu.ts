import { useState, useEffect, type RefObject } from 'react'

export function usePdfContextMenu(containerRef: RefObject<HTMLElement | null>) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const container = containerRef.current
      if (container && e.target instanceof Node && container.contains(e.target)) {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY })
      } else {
        setContextMenu(null)
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [containerRef])

  return {
    contextMenu,
    setContextMenu
  }
}

import { useState, useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * PDF custom context menu hook
 * Returns position state for custom menu rendering
 */
export function usePdfContextMenu(containerRef: RefObject<HTMLElement | null>) {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            const container = containerRef.current
            // Check if click is inside the container
            if (container && e.target instanceof Node && container.contains(e.target)) {
                e.preventDefault()
                // Set position
                setContextMenu({ x: e.clientX, y: e.clientY })
            } else {
                // If context menu is open and we right click elsewhere, close it
                setContextMenu(null)
            }
        }

        // Global listener to capture right clicks
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

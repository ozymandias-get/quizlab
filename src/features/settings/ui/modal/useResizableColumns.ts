import { useCallback, useState } from 'react'

const MIN_WIDTH = 250
const MAX_WIDTH = 480

export function useResizableColumns(initialSidebar = 290) {
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebar)

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((prev) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, prev + delta)))
  }, [])

  return { sidebarWidth, handleSidebarResize }
}

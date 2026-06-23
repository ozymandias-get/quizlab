import { useCallback, useState } from 'react'

const MIN_WIDTH = 180
const MAX_WIDTH = 500

export function useResizableColumns(initialSidebar = 220, initialList = 280) {
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebar)
  const [listWidth, setListWidth] = useState(initialList)

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((prev) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, prev + delta)))
  }, [])

  const handleListResize = useCallback((delta: number) => {
    setListWidth((prev) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, prev + delta)))
  }, [])

  return { sidebarWidth, listWidth, handleSidebarResize, handleListResize }
}

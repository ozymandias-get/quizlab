import { useEffect, useRef, useMemo } from 'react'
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation'
import { zoomPlugin } from '@react-pdf-viewer/zoom'
import { scrollModePlugin } from '@react-pdf-viewer/scroll-mode'
import { searchPlugin } from '@react-pdf-viewer/search'

type JumpToPage = (pageIndex: number) => void

export function usePdfPlugins() {
  const pageNavigationPluginInstance = pageNavigationPlugin()
  const { jumpToPage } = pageNavigationPluginInstance

  const zoomPluginInstance = zoomPlugin({
    enableShortcuts: true
  })
  const { ZoomIn, ZoomOut, CurrentScale, zoomTo } = zoomPluginInstance

  const scrollModePluginInstance = scrollModePlugin()

  const searchPluginInstance = searchPlugin()
  const { highlight, clearHighlights } = searchPluginInstance

  const plugins = useMemo(
    () => [
      pageNavigationPluginInstance,
      zoomPluginInstance,
      scrollModePluginInstance,
      searchPluginInstance
    ],
    [
      pageNavigationPluginInstance,
      zoomPluginInstance,
      scrollModePluginInstance,
      searchPluginInstance
    ]
  )

  const jumpToPageRef = useRef<JumpToPage>(jumpToPage)
  useEffect(() => {
    jumpToPageRef.current = jumpToPage
  }, [jumpToPage])

  return {
    plugins,
    jumpToPage,
    jumpToPageRef,
    ZoomIn,
    ZoomOut,
    CurrentScale,
    zoomTo,
    highlight,
    clearHighlights
  }
}

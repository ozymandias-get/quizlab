import React, { useEffect, useRef, useMemo } from 'react'
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation'
import { zoomPlugin } from '@react-pdf-viewer/zoom'
import { scrollModePlugin } from '@react-pdf-viewer/scroll-mode'
import { searchPlugin } from '@react-pdf-viewer/search'
import type { RenderHighlightsProps } from '@react-pdf-viewer/search'

type JumpToPage = (pageIndex: number) => void

const safeRenderHighlights = (props: RenderHighlightsProps) => {
  if (!props) return React.createElement(React.Fragment, null)
  const areas = props.highlightAreas
  if (!areas || !Array.isArray(areas) || areas.length === 0) {
    return React.createElement(React.Fragment, null)
  }
  return React.createElement(
    React.Fragment,
    null,
    areas.map((area, index) =>
      React.createElement('div', {
        key: index,
        className: 'rpv-search__highlight',
        'data-index': index,
        style: typeof props.getCssProperties === 'function' ? props.getCssProperties(area) : {},
        title: area?.keywordStr?.trim() ?? ''
      })
    )
  )
}

export function usePdfPlugins() {
  const {
    pageNavigationPluginInstance,
    zoomPluginInstance,
    scrollModePluginInstance,
    searchPluginInstance
  } = useMemo(() => {
    const pageNav = pageNavigationPlugin()
    const zoom = zoomPlugin({ enableShortcuts: true })
    const scrollMode = scrollModePlugin()
    const search = searchPlugin({
      renderHighlights: safeRenderHighlights
    })
    return {
      pageNavigationPluginInstance: pageNav,
      zoomPluginInstance: zoom,
      scrollModePluginInstance: scrollMode,
      searchPluginInstance: search
    }
  }, [])

  const { jumpToPage } = pageNavigationPluginInstance
  const { ZoomIn, ZoomOut, CurrentScale, zoomTo } = zoomPluginInstance
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

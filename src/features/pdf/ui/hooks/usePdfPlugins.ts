import React, { useEffect, useRef } from 'react'
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
  // Plugin factories use React hooks internally (useMemo, useState, useEffect
  // via useSearch, etc.) so they MUST be called unconditionally at the top level
  // — never inside useMemo/useCallback. Wrapping them caused a Rules-of-Hooks
  // violation that corrupted hook state, leading to "Cannot read properties of
  // undefined (reading 'length')" when the search plugin's keyword state
  // resolved to undefined instead of [].
  const pageNavigationPluginInstance = pageNavigationPlugin()
  const { jumpToPage } = pageNavigationPluginInstance

  const zoomPluginInstance = zoomPlugin({ enableShortcuts: true })
  const { ZoomIn, ZoomOut, CurrentScale, zoomTo } = zoomPluginInstance

  const scrollModePluginInstance = scrollModePlugin()

  const searchPluginInstance = searchPlugin({
    renderHighlights: safeRenderHighlights
  })
  const { highlight, clearHighlights } = searchPluginInstance

  const plugins = [
    pageNavigationPluginInstance,
    zoomPluginInstance,
    scrollModePluginInstance,
    searchPluginInstance
  ]

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

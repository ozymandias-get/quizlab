import type { Plugin } from '@react-pdf-viewer/core'
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation'
import type { RenderHighlightsProps } from '@react-pdf-viewer/search'
import { searchPlugin } from '@react-pdf-viewer/search'
import { zoomPlugin } from '@react-pdf-viewer/zoom'
import { createElement, Fragment, useRef } from 'react'

type JumpToPage = (pageIndex: number) => void

const safeRenderHighlights = (props: RenderHighlightsProps) => {
  if (!props) return createElement(Fragment, null)
  const areas = props.highlightAreas
  if (!areas || !Array.isArray(areas) || areas.length === 0) {
    return createElement(Fragment, null)
  }
  return createElement(
    Fragment,
    null,
    areas.map((area, index) => {
      const baseStyle =
        typeof props.getCssProperties === 'function' ? props.getCssProperties(area) : {}
      return createElement('div', {
        // eslint-disable-next-line react/no-array-index-key
        key: index,
        className: 'rpv-search__highlight',
        'data-index': index,
        style: {
          ...baseStyle,
          opacity: 0,
          animation: 'pdf-highlight-fadein 0.15s ease 0.4s forwards'
        },
        title: area?.keywordStr?.trim() ?? ''
      })
    })
  )
}

type StableUI = {
  ZoomIn: ReturnType<typeof zoomPlugin>['ZoomIn']
  ZoomOut: ReturnType<typeof zoomPlugin>['ZoomOut']
  CurrentScale: ReturnType<typeof zoomPlugin>['CurrentScale']
  zoomTo: ReturnType<typeof zoomPlugin>['zoomTo']
  highlight: ReturnType<typeof searchPlugin>['highlight']
  clearHighlights: ReturnType<typeof searchPlugin>['clearHighlights']
}

export function usePdfPlugins() {
  // Plugin factory'leri HER render'da koşulsuz çağrılmalıdır.
  // @react-pdf-viewer plugin'leri dahili olarak React hook kullanır;
  // koşullu çağrılırlarsa hook sırası render'lar arası değişir ve React patlar.
  // Viewer'a yalnızca ilk render'ın instance'ları bağlıdır (ref ile saklanır),
  // sonraki render'larda oluşturulan instance'lar yalnızca hook tutarlılığı için çağrılır.
  const pageNav = pageNavigationPlugin()
  const zoom = zoomPlugin({ enableShortcuts: true })
  const search = searchPlugin({ renderHighlights: safeRenderHighlights })

  // İlk render'ın instance'larını sakla (Viewer bunlara bağlı)
  const stablePluginsRef = useRef<Plugin[] | null>(null)
  const stableJumpToPageRef = useRef<JumpToPage | null>(null)
  const stableUIRef = useRef<StableUI | null>(null)

  if (stablePluginsRef.current === null) {
    stablePluginsRef.current = [pageNav, zoom, search]
    stableJumpToPageRef.current = pageNav.jumpToPage
    stableUIRef.current = {
      ZoomIn: zoom.ZoomIn,
      ZoomOut: zoom.ZoomOut,
      CurrentScale: zoom.CurrentScale,
      zoomTo: zoom.zoomTo,
      highlight: search.highlight,
      clearHighlights: search.clearHighlights
    }
  }

  // jumpToPageRef her zaman ilk instance'ın jumpToPage'ini tutar
  const jumpToPageRef = useRef<JumpToPage>(stableJumpToPageRef.current!)
  jumpToPageRef.current = stableJumpToPageRef.current!

  const { ZoomIn, ZoomOut, CurrentScale, zoomTo, highlight, clearHighlights } = stableUIRef.current!

  return {
    plugins: stablePluginsRef.current,
    jumpToPageRef,
    ZoomIn,
    ZoomOut,
    CurrentScale,
    zoomTo,
    highlight,
    clearHighlights
  }
}

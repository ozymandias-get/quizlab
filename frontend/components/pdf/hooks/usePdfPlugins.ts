import { useEffect, useRef, useMemo } from 'react'
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation'
import { zoomPlugin } from '@react-pdf-viewer/zoom'
import { scrollModePlugin } from '@react-pdf-viewer/scroll-mode'
import { searchPlugin } from '@react-pdf-viewer/search'

/**
 * PDF Viewer plugin'lerini yöneten custom hook.
 * Plugin instance'larını oluşturur ve API'lerini döner.
 */
type JumpToPage = (pageIndex: number) => void

export function usePdfPlugins() {
    // Plugin instance'larını oluştur.
    // DİKKAT: Bu fonksiyonlar içlerinde hook kullandığı için (react-pdf-viewer v3+)
    // useMemo içinde ÇAĞRILAMAZLAR. Doğrudan top-level'da çağrılmalılar.
    const pageNavigationPluginInstance = pageNavigationPlugin()
    const { jumpToPage } = pageNavigationPluginInstance

    const zoomPluginInstance = zoomPlugin({
        enableShortcuts: false,
    })
    const { ZoomIn, ZoomOut, CurrentScale, zoomTo } = zoomPluginInstance

    const scrollModePluginInstance = scrollModePlugin()

    const searchPluginInstance = searchPlugin()
    const { highlight, clearHighlights } = searchPluginInstance

    const plugins = useMemo(() => [
        pageNavigationPluginInstance,
        zoomPluginInstance,
        scrollModePluginInstance,
        searchPluginInstance
    ], [pageNavigationPluginInstance, zoomPluginInstance, scrollModePluginInstance, searchPluginInstance])

    // jumpToPage ref'i - useCallback içinde kullanmak için
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

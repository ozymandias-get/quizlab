import { useRef, useState, memo, CSSProperties, useEffect, useMemo } from 'react'
import { useAi } from '@src/app/providers/AiContext'
import { useAppTools } from '@src/app/providers/AppToolContext'
import { useLanguage } from '@src/app/providers/LanguageContext'
import {
    Maximize,
    Crop,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    RefreshCw
} from 'lucide-react'

// @react-pdf-viewer imports
import { Viewer, SpecialZoomLevel, ScrollMode, LoadError } from '@react-pdf-viewer/core'

// PDF Viewer stilleri
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/page-navigation/lib/styles/index.css'
import '@react-pdf-viewer/zoom/lib/styles/index.css'
import '@react-pdf-viewer/search/lib/styles/index.css'

// Modular Components
import PdfPlaceholder from './PdfPlaceholder'
import PdfToolbar from './PdfToolbar'
import { ContextMenu, MenuItem } from './ContextMenu'


// Custom Hooks
import {
    usePdfPlugins,
    usePdfNavigation,
    usePdfTextSelection,
    usePdfScreenshot,
    usePdfContextMenu
} from './hooks'
import type { PdfFile } from '@shared/types'

interface PdfViewerProps {
    pdfFile: PdfFile | null;
    onSelectPdf: () => void;
    onTextSelection?: (text: string, position: { top: number; left: number } | null) => void;
    t?: (key: string) => string;
    initialPage?: number;
    onResumePdf?: () => void;
    lastReadingInfo?: { name: string; page: number; totalPages: number; path: string } | null;
}

/**
 * PDF Viewer Main Component
 * Orchestrates modular hooks and sub-components.
 * Virtualization is enabled by default in react-pdf-viewer, but 
 * optimized here with Worker and stable plugin references.
 */
function PdfViewer({ pdfFile, onSelectPdf, onTextSelection, t: propT, initialPage, onResumePdf, lastReadingInfo }: PdfViewerProps) {
    const { autoSend, toggleAutoSend, sendImageToAI } = useAi()
    const { startScreenshot } = useAppTools()
    const { t: contextT } = useLanguage()
    const t = propT || contextT || ((k: string) => k)

    // Local state
    const containerRef = useRef<HTMLDivElement>(null)
    const [scaleFactor, setScaleFactor] = useState(1)

    // Derived state
    const pdfUrl = pdfFile?.streamUrl

    // === CUSTOM HOOKS ===
    const {
        plugins,
        jumpToPageRef,
        ZoomIn: PluginZoomIn,
        ZoomOut: PluginZoomOut,
        zoomTo,
        CurrentScale,
        highlight,
        clearHighlights
    } = usePdfPlugins()

    const {
        currentPage,
        totalPages,
        handlePageChange,
        handleDocumentLoad,
        goToPreviousPage,
        goToNextPage
    } = usePdfNavigation({
        containerRef,
        jumpToPageRef
    })

    const { handleFullPageScreenshot } = usePdfScreenshot({
        currentPage,
        sendImageToAI,
        startScreenshot
    })

    usePdfTextSelection({
        containerRef,
        onTextSelection: onTextSelection || (() => { })
    })

    const { contextMenu, setContextMenu } = usePdfContextMenu(containerRef)

    // initialPage belirtilmişse, doküman yüklendiginde o sayfaya atla
    const initialPageApplied = useRef(false)
    useEffect(() => {
        if (initialPage && initialPage > 1 && totalPages > 0 && !initialPageApplied.current) {
            // 0-indexed
            const targetPage = Math.min(initialPage - 1, totalPages - 1)
            jumpToPageRef.current(targetPage)
            initialPageApplied.current = true
        }
    }, [initialPage, totalPages, jumpToPageRef])

    const menuItems: MenuItem[] = useMemo(() => [
        {
            label: t('ctx_full_page_screenshot'),
            icon: Maximize,
            onClick: handleFullPageScreenshot,
            shortcut: 'Ctrl+S'
        },
        {
            label: t('ctx_crop_screenshot'),
            icon: Crop,
            onClick: startScreenshot,
            shortcut: 'Shift+S'
        },
        { separator: true, label: '', onClick: () => { } },
        {
            label: t('ctx_zoom_in'),
            icon: ZoomIn,
            onClick: () => zoomTo(scaleFactor + 0.1),
            shortcut: 'Ctrl+'
        },
        {
            label: t('ctx_zoom_out'),
            icon: ZoomOut,
            onClick: () => zoomTo(Math.max(0.1, scaleFactor - 0.1)),
            shortcut: 'Ctrl-'
        },
        {
            label: t('ctx_reset_zoom'),
            icon: RotateCcw,
            onClick: () => zoomTo(SpecialZoomLevel.PageWidth),
            shortcut: 'Ctrl+0'
        },
        { separator: true, label: '', onClick: () => { } },
        {
            label: t('ctx_reload'),
            icon: RefreshCw,
            onClick: () => window.location.reload(),
            shortcut: 'Ctrl+R',
            danger: true
        }
    ], [t, handleFullPageScreenshot, startScreenshot, zoomTo, scaleFactor])


    // === RENDER ===
    if (!pdfUrl) {
        return <PdfPlaceholder onSelectPdf={onSelectPdf} onResumePdf={onResumePdf} lastReadingInfo={lastReadingInfo} />
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden h-full min-h-0">
            <div
                ref={containerRef}
                className="flex-1 overflow-hidden pdf-viewer-container h-full min-h-0 relative flex flex-col"
                style={{ '--scale-factor': scaleFactor } as CSSProperties}
                onWheel={(e: React.WheelEvent<HTMLDivElement>) => {
                    // Ctrl+wheel zoom'u tamamen devre dışı bırak
                    // Sadece UI üzerindeki +/- butonlarıyla zoom yapılabilir
                    if (e.ctrlKey || e.metaKey) {
                        return
                    }
                }}
            >
                <Viewer
                    fileUrl={pdfUrl}
                    plugins={plugins}
                    defaultScale={SpecialZoomLevel.PageWidth}
                    scrollMode={ScrollMode.Page}
                    onPageChange={handlePageChange}
                    onDocumentLoad={handleDocumentLoad}
                    onZoom={(e) => setScaleFactor(e.scale)}
                    renderError={(error: LoadError) => (
                        <div className="flex items-center justify-center h-full text-red-500 p-8 text-center bg-stone-950/50 backdrop-blur-sm">
                            <p>{t('pdf_load_error')}: {error.message || t('error_unknown_error')}</p>
                        </div>
                    )}
                    renderPage={(props) => (
                        <>
                            {props.canvasLayer.children}
                            {props.textLayer.children}
                            {props.annotationLayer.children}
                        </>
                    )}
                    theme={{
                        theme: 'dark',
                    }}
                />

                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        items={menuItems}
                        onClose={() => setContextMenu(null)}
                    />
                )}
            </div>

            <PdfToolbar
                pdfFile={pdfFile}
                onSelectPdf={onSelectPdf}
                onStartScreenshot={startScreenshot}
                onFullPageScreenshot={handleFullPageScreenshot}
                autoSend={autoSend}
                onToggleAutoSend={toggleAutoSend}
                currentPage={currentPage}
                totalPages={totalPages}
                onPreviousPage={goToPreviousPage}
                onNextPage={goToNextPage}
                highlight={highlight}
                clearHighlights={clearHighlights}
                ZoomIn={PluginZoomIn}
                ZoomOut={PluginZoomOut}
                CurrentScale={CurrentScale}
            />
        </div>
    )
}

export default memo(PdfViewer)



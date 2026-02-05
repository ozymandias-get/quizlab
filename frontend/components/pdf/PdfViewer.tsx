import { useRef, useState, memo, CSSProperties } from 'react'
import { useAi } from '../../context/AiContext'
import { useAppTools } from '../../context/AppToolContext'
import { useLanguage } from '../../context/LanguageContext'

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

// Custom Hooks
import {
    usePdfPlugins,
    usePdfNavigation,
    usePdfTextSelection,
    usePdfScreenshot,
    usePdfContextMenu
} from './hooks'
import type { PdfFile } from '../../types/pdf'

interface PdfViewerProps {
    pdfFile: PdfFile | null;
    onSelectPdf: () => void;
    onTextSelection?: (text: string, position: { top: number; left: number } | null) => void;
    t?: (key: string) => string;
}

/**
 * PDF Viewer Main Component
 * Orchestrates modular hooks and sub-components.
 * Virtualization is enabled by default in react-pdf-viewer, but 
 * optimized here with Worker and stable plugin references.
 */
function PdfViewer({ pdfFile, onSelectPdf, onTextSelection, t: propT }: PdfViewerProps) {
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
        ZoomIn,
        ZoomOut,
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

    usePdfContextMenu(containerRef, t)

    // === RENDER ===
    if (!pdfUrl) {
        return <PdfPlaceholder onSelectPdf={onSelectPdf} />
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
                        e.preventDefault()
                        e.stopPropagation()
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
                    theme={{
                        theme: 'dark',
                    }}
                />
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
                ZoomIn={ZoomIn}
                ZoomOut={ZoomOut}
                CurrentScale={CurrentScale}
            />
        </div>
    )
}

export default memo(PdfViewer)

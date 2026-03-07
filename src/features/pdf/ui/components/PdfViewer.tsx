import { useRef, useState, memo, CSSProperties, useEffect, useMemo } from 'react'
import { useLocalStorage } from '@shared/hooks'
import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'
import { useAi } from '@app/providers/AiContext'
import { useAppTools } from '@app/providers/AppToolContext'
import { useLanguage } from '@app/providers/LanguageContext'
import {
    Maximize,
    Crop,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    RefreshCw
} from 'lucide-react'
import {
    DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS,
    GOOGLE_AI_WEB_SESSION_PARTITION,
    GOOGLE_DRIVE_WEB_APP
} from '@shared-core/constants/google-ai-web-apps'

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
import { getAiIcon, RefreshIcon } from '@ui/components/Icons'


// Custom Hooks
import {
    usePdfPlugins,
    usePdfNavigation,
    usePdfTextSelection,
    usePdfScreenshot,
    usePdfContextMenu
} from '../hooks'
import type { PdfFile } from '@shared-core/types'
import type { LastReadingInfo } from '@features/pdf/hooks/usePdfSelection'
import type { PdfTab, ResumePdfResult } from '@features/pdf/hooks/usePdfSelection'

interface PdfViewerProps {
    pdfFile: PdfFile | null;
    activePdfTab?: PdfTab | null;
    onSelectPdf: () => void;
    onTextSelection?: (text: string, position: { top: number; left: number } | null) => void;
    t?: (key: string) => string;
    initialPage?: number;
    onResumePdf?: (path?: string) => Promise<ResumePdfResult> | ResumePdfResult;
    onClearResumePdf?: (path?: string) => void;
    onRestoreResumePdf?: (info: LastReadingInfo, index?: number) => void;
    lastReadingInfo?: LastReadingInfo[] | null;
    onOpenGoogleDrive?: () => void;
    isInteractionBlocked?: boolean;
}

/**
 * PDF Viewer Main Component
 * Orchestrates modular hooks and sub-components.
 * Virtualization is enabled by default in react-pdf-viewer, but 
 * optimized here with Worker and stable plugin references.
 */
function PdfViewer({ pdfFile, activePdfTab, onSelectPdf, onTextSelection, t: propT, initialPage, onResumePdf, onClearResumePdf, onRestoreResumePdf, lastReadingInfo, onOpenGoogleDrive, isInteractionBlocked = false }: PdfViewerProps) {
    const { autoSend, toggleAutoSend, sendImageToAI, chromeUserAgent } = useAi()
    const { startScreenshot } = useAppTools()
    const { t: contextT } = useLanguage()
    const { data: webSessionData } = useGeminiWebStatus()
    const [enabledGoogleApps] = useLocalStorage<string[]>(
        'gwsEnabledApps',
        DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS
    )
    const t = propT || contextT || ((k: string) => k)

    // Local state
    const containerRef = useRef<HTMLDivElement>(null)
    const driveWebviewRef = useRef<any>(null)
    const [scaleFactor, setScaleFactor] = useState(1)

    // Derived state
    const pdfUrl = pdfFile?.streamUrl
    const isGoogleDriveEnabled = !!webSessionData?.featureEnabled
        && !!webSessionData?.enabled
        && enabledGoogleApps.includes('gdrive')

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
        jumpToPageRef,
        pdfPath: pdfFile?.path || null
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
        initialPageApplied.current = false
    }, [pdfUrl, initialPage])

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
    if (activePdfTab?.kind === 'drive') {
        return (
            <div className="flex-1 flex flex-col overflow-hidden h-full min-h-0">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/20 px-4 py-3 backdrop-blur-xl">
                    <div className="min-w-0 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[#1a73e8]/15 text-[#1a73e8]">
                            {getAiIcon('gdrive')}
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-stone-200">{GOOGLE_DRIVE_WEB_APP.name}</div>
                            <div className="truncate text-[11px] text-stone-500">{t('gdrive_pdf_desc')}</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => driveWebviewRef.current?.reload?.()}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-stone-200 transition-colors hover:bg-white/10"
                    >
                        <RefreshIcon className="w-4 h-4" />
                        {t('ctx_reload')}
                    </button>
                </div>

                <div className="relative flex-1 min-h-0">
                    <webview
                        ref={driveWebviewRef}
                        key={activePdfTab.id}
                        src={activePdfTab.webviewUrl || GOOGLE_DRIVE_WEB_APP.url}
                        partition={GOOGLE_AI_WEB_SESSION_PARTITION}
                        className="flex-1 w-full h-full"
                        allowpopups={"true" as any}
                        webpreferences="contextIsolation=yes, sandbox=no"
                        useragent={chromeUserAgent}
                    />
                    {isInteractionBlocked && (
                        <div className="absolute inset-0 z-10 pointer-events-auto bg-transparent" />
                    )}
                </div>
            </div>
        )
    }

    if (!pdfUrl) {
        return (
            <PdfPlaceholder
                onSelectPdf={onSelectPdf}
                onResumePdf={onResumePdf}
                onClearResumePdf={onClearResumePdf}
                onRestoreResumePdf={onRestoreResumePdf}
                lastReadingInfo={lastReadingInfo}
                onOpenGoogleDrive={isGoogleDriveEnabled ? onOpenGoogleDrive : undefined}
            />
        )
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









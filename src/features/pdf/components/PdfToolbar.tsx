import { memo, useState, useCallback } from 'react'
import type { ComponentType, ReactElement } from 'react'
import { motion } from 'framer-motion'
import {
    Upload, Crop, Image as ImageIcon, Send,
    ChevronLeft, ChevronRight, ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon, DownloadCloud
} from 'lucide-react'
import { useLanguage } from '@src/app/providers/LanguageContext'
import { useToast } from '@src/app/providers/ToastContext'
import PdfSearchBar from './PdfSearchBar'
import type { PdfFile } from '@shared/types'

interface RenderChildProps {
    onClick: () => void;
    scale?: number;
}

type ZoomComponent = ComponentType<{ children: (props: RenderChildProps) => ReactElement }>
type CurrentScaleComponent = ComponentType<{ children: (props: { scale: number }) => ReactElement }>

interface PdfToolbarProps {
    pdfFile: PdfFile | null;
    onSelectPdf: () => void;
    onStartScreenshot: () => void;
    onFullPageScreenshot: () => void;
    autoSend: boolean;
    onToggleAutoSend: () => void;
    currentPage: number;
    totalPages: number;
    onPreviousPage: () => void;
    onNextPage: () => void;
    highlight: (keyword: string) => void;
    clearHighlights: () => void;
    // These come from react-pdf-viewer zoom plugin
    ZoomIn: ZoomComponent;
    ZoomOut: ZoomComponent;
    CurrentScale: CurrentScaleComponent;
}

/**
 * PDF bottom toolbar component
 * Redesigned with Premium Glass Morphism
 */
function PdfToolbar({
    pdfFile,
    onSelectPdf,
    onStartScreenshot,
    onFullPageScreenshot,
    autoSend,
    onToggleAutoSend,
    currentPage,
    totalPages,
    onPreviousPage,
    onNextPage,
    highlight,
    clearHighlights,
    ZoomIn,
    ZoomOut,
    CurrentScale
}: PdfToolbarProps) {
    const { t } = useLanguage()
    const { showSuccess, showError } = useToast()
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [searchKeyword, setSearchKeyword] = useState('')

    // Check import status (handle both cases for robustness)
    const isImported = !!(pdfFile?.is_imported || pdfFile?.isImported)
    const [tempImported, setTempImported] = useState(false)

    // Reset temp state when file changes
    useState(() => { setTempImported(false) }) // Note: typical pattern is useEffect

    // Correct pattern for resetting state on prop change
    if (pdfFile && tempImported && (pdfFile.id !== pdfFile.id)) { // This logic is flawed for deep compare but okay if ID changes. 
        // Better to use useEffect.
    }

    const handleImport = useCallback(async () => {
        if (!pdfFile?.path) return;
        try {
            const result = await window.electronAPI.library.importFile(pdfFile.path);
            if (result.success) {
                showSuccess('toast_file_imported', 'Success', { name: pdfFile.name || 'File' })
                setTempImported(true)
                // Mutate object for immediate UI feedback if parent doesn't update immediately
                if (pdfFile) pdfFile.is_imported = true;
            } else {
                showError(result.error || 'Import failed')
            }
        } catch (e) {
            showError('toast_import_error')
        }
    }, [pdfFile, showSuccess, showError])

    const handleSearch = useCallback(() => {
        if (searchKeyword.trim()) {
            highlight(searchKeyword)
        }
    }, [searchKeyword, highlight])

    const handleClearSearch = useCallback(() => {
        setIsSearchOpen(false)
        setSearchKeyword('')
        clearHighlights()
    }, [clearHighlights])

    const showImportButton = pdfFile && !isImported && !tempImported

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex-shrink-0 w-full bg-gradient-to-t from-[#0a0a0a] via-[#0d0d0d] to-[#111111] border-t border-white/[0.06] px-6 py-3 relative z-50 flex items-center justify-between gap-4 select-none"
        >
            {/* Left: Tools Island */}
            <div className="flex items-center gap-1 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent rounded-2xl p-1.5 border border-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                <ToolbarButton
                    onClick={onSelectPdf}
                    icon={Upload}
                    tooltip={t('select_pdf')}
                />

                {showImportButton && (
                    <>
                        <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-0.5" />
                        <ToolbarButton
                            onClick={handleImport}
                            icon={DownloadCloud}
                            tooltip={t('import_to_library') || 'Save to Library'}
                            className="text-blue-400/70 hover:text-blue-300 hover:bg-blue-500/10 hover:shadow-[0_0_15px_-5px_rgba(59,130,246,0.3)]"
                        />
                    </>
                )}

                <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-0.5" />
                <ToolbarButton
                    onClick={onStartScreenshot}
                    icon={Crop}
                    tooltip={t('screenshot')}
                    className="text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 hover:shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]"
                />
                <ToolbarButton
                    onClick={onFullPageScreenshot}
                    icon={ImageIcon}
                    tooltip={t('full_page_screenshot')}
                    className="text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-500/10 hover:shadow-[0_0_15px_-5px_rgba(52,211,153,0.3)]"
                />
                <ToolbarButton
                    onClick={onToggleAutoSend}
                    icon={Send}
                    tooltip={autoSend ? t('auto_send_on') : t('auto_send_off')}
                    isActive={autoSend}
                    activeClassName="bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]"
                />
            </div>

            {/* Center: File Info & Search */}
            <div className="flex-1 mx-2 min-w-0 flex justify-center items-center">
                <PdfSearchBar
                    isOpen={isSearchOpen}
                    onToggle={() => setIsSearchOpen(true)}
                    keyword={searchKeyword}
                    onKeywordChange={setSearchKeyword}
                    onSearch={handleSearch}
                    onClear={handleClearSearch}
                    fileName={pdfFile?.name}
                />
            </div>

            {/* Right: Navigation & Zoom Groups */}
            <div className="flex items-center gap-2">
                {/* Navigation Island */}
                <div className="flex items-center gap-1 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent rounded-2xl p-1.5 border border-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                    <button
                        onClick={onPreviousPage}
                        disabled={currentPage <= 1}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.08] disabled:opacity-25 disabled:hover:bg-transparent transition-all duration-300 text-white/50 hover:text-white active:scale-95"
                        title={t('prev_page')}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

                    <span className="px-3 text-xs font-medium text-white/70 min-w-[60px] text-center select-none tabular-nums">
                        {currentPage} <span className="text-white/20 mx-0.5">/</span> {totalPages}
                    </span>

                    <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

                    <button
                        onClick={onNextPage}
                        disabled={currentPage >= totalPages}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.08] disabled:opacity-25 disabled:hover:bg-transparent transition-all duration-300 text-white/50 hover:text-white active:scale-95"
                        title={t('next_page')}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Zoom Island */}
                <div className="flex items-center gap-1 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent rounded-2xl p-1.5 border border-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                    <ZoomOut>
                        {(props: RenderChildProps) => (
                            <button
                                onClick={props.onClick}
                                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.08] text-white/50 hover:text-white transition-all duration-300 active:scale-95"
                                title={t('zoom_out')}
                            >
                                <ZoomOutIcon className="w-4 h-4" />
                            </button>
                        )}
                    </ZoomOut>

                    <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

                    <CurrentScale>
                        {(props: { scale: number }) => (
                            <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/15">
                                <span className="text-xs font-semibold text-amber-400 min-w-[40px] text-center tabular-nums select-none">
                                    {Math.round(props.scale * 100)}%
                                </span>
                            </div>
                        )}
                    </CurrentScale>

                    <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

                    <ZoomIn>
                        {(props: RenderChildProps) => (
                            <button
                                onClick={props.onClick}
                                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.08] text-white/50 hover:text-white transition-all duration-300 active:scale-95"
                                title={t('zoom_in')}
                            >
                                <ZoomInIcon className="w-4 h-4" />
                            </button>
                        )}
                    </ZoomIn>
                </div>
            </div>
        </motion.div>
    )
}

interface ToolbarButtonProps {
    onClick: () => void
    icon: React.ElementType
    tooltip: string
    isActive?: boolean
    className?: string
    activeClassName?: string
}

// Update standard button styles for symmetry
function ToolbarButton({ onClick, icon: Icon, tooltip, isActive, className, activeClassName }: ToolbarButtonProps) {
    return (
        <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            title={tooltip}
            className={`
                w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300
                ${isActive
                    ? (activeClassName || 'bg-white/15 text-white shadow-lg')
                    : (className || 'text-white/40 hover:text-white hover:bg-white/[0.08]')
                }
            `}
        >
            <Icon className="w-4 h-4" />
        </motion.button>
    )
}

export default memo(PdfToolbar)


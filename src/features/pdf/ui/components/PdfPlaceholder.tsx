import { memo } from 'react'
import PdfPlaceholderActions from './pdfPlaceholder/PdfPlaceholderActions'
import PdfRecentControls from './pdfPlaceholder/PdfRecentControls'
import PdfRecentList from './pdfPlaceholder/PdfRecentList'
import { usePdfPlaceholderState } from './pdfPlaceholder/usePdfPlaceholderState'
import type { LastReadingInfo, ResumePdfResult } from '@features/pdf/hooks/usePdfSelection'

interface PdfPlaceholderProps {
    onSelectPdf: () => void;
    onOpenGoogleDrive?: () => void;
    onResumePdf?: (path?: string) => Promise<ResumePdfResult> | ResumePdfResult;
    onClearResumePdf?: (path?: string) => void;
    onRestoreResumePdf?: (info: LastReadingInfo, index?: number) => void;
    lastReadingInfo?: LastReadingInfo[] | null;
}

function PdfPlaceholder({
    onSelectPdf,
    onOpenGoogleDrive,
    onResumePdf,
    onClearResumePdf,
    onRestoreResumePdf,
    lastReadingInfo
}: PdfPlaceholderProps) {
    const {
        t,
        language,
        recentItems,
        processedItems,
        groupedItems,
        invalidPaths,
        searchQuery,
        sortMode,
        isMobileSearchOpen,
        shouldShowAdvancedControls,
        setSearchQuery,
        setSortMode,
        toggleMobileSearch,
        handleResume,
        handleRemove,
        handleClearAll
    } = usePdfPlaceholderState({
        onResumePdf,
        onClearResumePdf,
        onRestoreResumePdf,
        lastReadingInfo
    })

    return (
        <div className="h-full flex flex-col items-center justify-center gap-6 p-10 text-center bg-transparent animate-in fade-in zoom-in duration-700">
            <div className="w-28 h-28 rounded-3xl bg-white/5 backdrop-blur-xl border-2 border-dashed border-white/10 flex items-center justify-center text-stone-500 transition-all duration-300 hover:border-amber-500/50 hover:text-amber-500/70 hover:bg-white/10 hover:shadow-2xl hover:shadow-amber-500/10">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 13H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M9 17H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </div>

            <div className="space-y-3">
                <h2 className="font-display text-2xl font-semibold text-stone-200">{t('no_pdf_loaded')}</h2>
                <p className="text-stone-500 text-sm max-w-[200px]">{t('drop_pdf_here')}</p>
            </div>

            <PdfPlaceholderActions
                t={t}
                onSelectPdf={onSelectPdf}
                onOpenGoogleDrive={onOpenGoogleDrive}
            />

            <div className="w-full max-w-[680px] flex flex-col gap-2 relative">
                <PdfRecentControls
                    t={t}
                    recentCount={recentItems.length}
                    shouldShowAdvancedControls={shouldShowAdvancedControls}
                    searchQuery={searchQuery}
                    sortMode={sortMode}
                    isMobileSearchOpen={isMobileSearchOpen}
                    canClear={!!onClearResumePdf}
                    onSearchQueryChange={setSearchQuery}
                    onSortModeChange={setSortMode}
                    onToggleMobileSearch={toggleMobileSearch}
                    onClearAll={handleClearAll}
                />

                <PdfRecentList
                    t={t}
                    language={language}
                    recentCount={recentItems.length}
                    processedCount={processedItems.length}
                    groupedItems={groupedItems}
                    invalidPaths={invalidPaths}
                    canResume={!!onResumePdf}
                    canClear={!!onClearResumePdf}
                    onResume={handleResume}
                    onRemove={handleRemove}
                />
            </div>
        </div>
    )
}

export default memo(PdfPlaceholder)

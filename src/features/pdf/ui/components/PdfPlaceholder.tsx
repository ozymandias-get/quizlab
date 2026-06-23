import type { LastReadingInfo, ResumePdfResult } from '@features/pdf/hooks/types'

import { FileText } from 'lucide-react'
import { memo } from 'react'

import PdfRecentControls from './pdfPlaceholder/PdfRecentControls'
import PdfRecentList from './pdfPlaceholder/PdfRecentList'
import { usePdfPlaceholderState } from './pdfPlaceholder/usePdfPlaceholderState'

interface PdfPlaceholderProps {
  onSelectPdf: () => void
  onResumePdf?: (path?: string) => Promise<ResumePdfResult> | ResumePdfResult
  onClearResumePdf?: (path?: string) => void
  onRestoreResumePdf?: (info: LastReadingInfo, index?: number) => void
  onRelinkPdf?: (oldPath: string) => Promise<boolean>
  lastReadingInfo?: LastReadingInfo[] | null
}

function PdfPlaceholder({
  onSelectPdf,
  onResumePdf,
  onClearResumePdf,
  onRestoreResumePdf,
  onRelinkPdf,
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
    handleRelink,
    handleRemove,
    handleClearAll
  } = usePdfPlaceholderState({
    onResumePdf,
    onClearResumePdf,
    onRestoreResumePdf,
    onRelinkPdf,
    lastReadingInfo
  })

  return (
    <div className="animate-in fade-in zoom-in flex h-full flex-col items-center justify-center overflow-hidden p-8 duration-500">
      <div className="flex max-h-full w-full max-w-[680px] flex-col items-center gap-5 text-center">
        <div className="flex flex-shrink-0 flex-col items-center gap-5 text-center">
          <button
            type="button"
            onClick={onSelectPdf}
            className="glass-tier-2 group relative flex h-20 w-20 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/[0.1] text-amber-400/70 shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition-colors duration-300 ease-out hover:-translate-y-1 hover:border-amber-400/30 hover:text-amber-400 hover:shadow-[0_0_24px_rgba(245,158,11,0.1)] focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none active:scale-95"
            aria-label={t('select_pdf')}
          >
            <FileText className="relative z-10 h-9 w-9 transition-transform duration-300 group-hover:scale-105" />
          </button>

          <div className="space-y-3">
            <h2 className="font-display text-ql-18 font-semibold text-stone-100">
              {t('no_pdf_loaded')}
            </h2>
            <p className="text-ql-13 max-w-[260px] leading-relaxed text-stone-400">
              {t('drop_pdf_here')}
            </p>
            <button
              type="button"
              onClick={onSelectPdf}
              className="text-ql-13 inline-flex items-center gap-2 rounded-xl bg-amber-400/10 px-5 py-2.5 font-medium text-amber-400 transition-all duration-200 hover:bg-amber-400/20 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none active:scale-95"
            >
              <FileText className="h-4 w-4" />
              {t('select_pdf')}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-y-auto">
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
            onRelink={handleRelink}
            onRemove={handleRemove}
          />
        </div>
      </div>
    </div>
  )
}

export default memo(PdfPlaceholder)

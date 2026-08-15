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
        <div className="flex flex-shrink-0 flex-col items-center gap-4 text-center">
          <button
            type="button"
            onClick={onSelectPdf}
            className="group border-border bg-card text-primary shadow-ambient-sm hover:border-primary/40 hover:bg-muted focus-visible:ring-ring/40 relative flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-xl border transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
            aria-label={t('select_pdf')}
          >
            <FileText className="h-8 w-8 transition-transform duration-150 group-hover:scale-105" />
          </button>

          <div className="space-y-2">
            <h2 className="text-ql-18 text-foreground font-semibold">{t('no_pdf_loaded')}</h2>
            <p className="text-ql-13 text-muted-foreground max-w-[260px] leading-relaxed">
              {t('drop_pdf_here')}
            </p>
            <button
              type="button"
              onClick={onSelectPdf}
              className="text-ql-13 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/40 inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-medium shadow-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
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

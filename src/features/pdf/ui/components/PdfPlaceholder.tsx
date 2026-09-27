import type { LastReadingInfo, ResumePdfResult } from '@features/pdf/hooks/types'

import { Button } from '@app/components/ui/button'
import { Kbd } from '@app/components/ui/kbd'
import { getShortcutModifierLabel } from '@shared/lib/shortcutUtils'

import { FileText, Upload } from 'lucide-react'
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
    /* Top-aligned (not `justify-center`): with centring, the hero drifted
       upward every time the reading history grew. The column now fills the
       panel so the history section can extend down and scroll instead. */
    <div className="animate-in fade-in zoom-in-98 motion-slow flex h-full flex-col items-center overflow-hidden px-5 py-6 select-none motion-reduce:animate-none">
      <div className="flex h-full w-full max-w-[680px] flex-col items-center gap-5">
        {/* Hero — flat drop surface, no nested dashed card */}
        <div className="border-border/60 bg-card/40 relative flex w-full max-w-sm shrink-0 flex-col items-center gap-3.5 rounded-2xl border px-6 py-7 text-center">
          <div className="bg-primary/5 motion-slow pointer-events-none absolute top-2 h-20 w-32 rounded-full blur-2xl" />
          <span
            aria-hidden
            className="border-primary/20 bg-primary/10 text-primary relative flex size-12 items-center justify-center rounded-2xl border"
          >
            <Upload className="h-5 w-5" />
          </span>

          <div className="space-y-1.5">
            <h2 className="text-ql-16 text-foreground tracking-ql-tight font-semibold">
              {t('no_pdf_loaded')}
            </h2>
            <p className="text-ql-12 text-muted-foreground mx-auto max-w-[280px] leading-relaxed">
              {t('drop_pdf_here')}
            </p>
          </div>

          <Button
            type="button"
            variant="default"
            size="lg"
            onClick={onSelectPdf}
            className="pdf-placeholder-cta focus-visible:ring-ring/40 h-9 cursor-pointer gap-2 px-4"
            aria-label={t('select_pdf')}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{t('select_pdf')}</span>
          </Button>

          <div className="text-muted-foreground flex items-center gap-1.5">
            <Kbd size="xs" variant="default">
              {getShortcutModifierLabel()}+O
            </Kbd>
            <span className="text-ql-11">{t('select_pdf_hint')}</span>
          </div>
        </div>

        {/* Recent Reading Section */}
        <div className="border-border/60 bg-card/30 flex min-h-0 w-full flex-1 flex-col gap-3 rounded-2xl border p-4 text-left">
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

          <div className="custom-scrollbar -mr-1 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
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
    </div>
  )
}

export default memo(PdfPlaceholder)

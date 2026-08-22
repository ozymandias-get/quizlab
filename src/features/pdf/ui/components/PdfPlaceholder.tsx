import type { LastReadingInfo, ResumePdfResult } from '@features/pdf/hooks/types'

import { Button } from '@app/components/ui/button'
import { Kbd } from '@app/components/ui/kbd'
import { getShortcutModifierLabel } from '@shared/lib/shortcutUtils'

import { FileText, Sparkles, Upload } from 'lucide-react'
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
    <div className="animate-in fade-in zoom-in-98 motion-slow flex h-full flex-col items-center justify-center overflow-hidden px-6 py-8 select-none motion-reduce:animate-none">
      <div className="flex max-h-full w-full max-w-[680px] flex-col items-center gap-4 text-center">
        {/* Hero — now built on the shared EmptyState primitive for a11y + token consistency */}
        <div className="border-border/80 hover:border-ring/60 bg-card/60 hover:bg-card/90 motion-slow relative flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed p-6 shadow-2xs transition-all">
          <Button
            type="button"
            size="icon-lg"
            onClick={onSelectPdf}
            className="border-primary/20 bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground focus-visible:ring-ring/40 motion-slow h-14 w-14 cursor-pointer rounded-xl border shadow-2xs transition-all focus-visible:ring-2 focus-visible:outline-none"
            aria-label={t('select_pdf')}
          >
            <Upload className="motion-slow h-6 w-6 transition-transform group-hover:-translate-y-0.5 motion-reduce:transform-none" />
          </Button>

          <div className="space-y-1.5 text-center">
            <h2 className="text-ql-15 text-foreground tracking-ql-tight font-semibold">
              {t('no_pdf_loaded')}
            </h2>
            <p className="text-ql-12 text-muted-foreground mx-auto max-w-[240px] leading-relaxed">
              {t('drop_pdf_here')}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSelectPdf}
            className="pdf-placeholder-cta border-border/80 bg-background text-foreground hover:border-ring/50 hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 gap-2 px-3.5 shadow-2xs"
          >
            <FileText className="text-primary h-3.5 w-3.5" />
            <span>{t('select_pdf')}</span>
            <Kbd size="xs" variant="default" className="ml-0.5 opacity-75">
              {getShortcutModifierLabel()}+O
            </Kbd>
          </Button>

          <div className="mt-3 grid w-full grid-cols-2 gap-2">
            <div className="border-border bg-card flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center shadow-xs">
              <FileText className="text-primary h-5 w-5" />
              <p className="text-ql-12 leading-none font-medium">
                {t('reader_mode_pdf', { defaultValue: 'Normal PDF' })}
              </p>
              <p className="text-muted-foreground text-ql-11 leading-relaxed">
                {t('reader_mode_pdf_desc', { defaultValue: 'Hızlı, orijinal görünüm' })}
              </p>
            </div>
            <div className="border-primary/20 bg-primary/5 flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center">
              <Sparkles className="text-primary h-5 w-5" />
              <p className="text-ql-12 leading-none font-medium">
                {t('reader_smart', { defaultValue: 'Akıllı Okuma' })}
              </p>
              <p className="text-muted-foreground text-ql-11 leading-relaxed">
                {t('reader_smart_desc', { defaultValue: 'Metin, başlık, tablo, görsel' })}
              </p>
            </div>
          </div>
          <p className="text-muted-foreground text-ql-11 mt-2 leading-relaxed">
            {t('reader_hint', {
              defaultValue:
                'Yükledikten sonra üstteki [PDF] / [Akıllı Okuma] ile görünümü değiştirebilirsiniz.'
            })}
          </p>
        </div>

        {/* Recent Reading Section */}
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

import type { LastReadingInfo, ResumePdfResult } from '@features/pdf/hooks/types'

import { BlurFade } from '@app/components/ui/blur-fade'
import { MagicCard } from '@app/components/ui/magic-card'
import { Button } from '@shared/ui/components/primitives'

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
       upward every time the reading history grew. On wide panels the hero and
       the history sit side by side so a long list cannot squeeze the primary
       "open a PDF" action; on narrow panels they stack and the list scrolls. */
    <div className="animate-in fade-in zoom-in-98 motion-slow flex h-full flex-col items-center overflow-hidden px-4 py-6 select-none motion-reduce:animate-none sm:px-6 sm:py-7">
      <div className="@container h-full w-full max-w-5xl">
        <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-5 @min-[680px]:grid-cols-[minmax(0,300px)_minmax(0,1fr)] @min-[680px]:grid-rows-1 @min-[680px]:gap-3 @min-[860px]:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          {/* Hero — a compact drop surface, vertically centred against the
              reading history so the column does not read as a small card
              stranded above a dead half-panel. */}
          <BlurFade className="w-full self-center">
            <MagicCard
              className="w-full rounded-2xl border-white/[0.07]"
              gradientColor="#18181b"
              gradientOpacity={0.35}
              gradientFrom="#27272a"
              gradientTo="#18181b"
            >
              <div className="group motion-normal relative flex min-h-[260px] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/[0.07] bg-zinc-950/80 px-6 py-8 text-center transition-colors hover:border-white/15 hover:bg-zinc-900/40">
                <span
                  aria-hidden
                  className="relative flex size-14 items-center justify-center rounded-2xl border shadow-xs transition-transform duration-300 group-hover:-translate-y-0.5"
                  style={{
                    color: 'var(--selection-color-source, oklch(var(--primary)))',
                    backgroundColor:
                      'color-mix(in srgb, var(--selection-color-source, oklch(var(--primary))) 12%, transparent)',
                    borderColor:
                      'color-mix(in srgb, var(--selection-color-source, oklch(var(--primary))) 25%, transparent)'
                  }}
                >
                  <Upload className="h-6 w-6" />
                </span>

                <div className="space-y-1.5">
                  <h2 className="text-ql-16 text-foreground tracking-ql-tight font-semibold">
                    {t('no_pdf_loaded')}
                  </h2>
                  <p className="text-ql-12 text-muted-foreground mx-auto max-w-[260px] leading-relaxed">
                    {t('drop_pdf_here')}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  onClick={onSelectPdf}
                  className="pdf-placeholder-cta focus-visible:ring-ring/70 h-9 cursor-pointer gap-2 rounded-xl border border-white/15 bg-zinc-900/90 px-4 text-zinc-100 shadow-sm hover:border-white/25 hover:bg-zinc-800/90"
                  aria-label={t('select_pdf')}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{t('select_pdf')}</span>
                </Button>
              </div>
            </MagicCard>
          </BlurFade>

          {/* Recent Reading Section */}
          <div className="flex min-h-0 w-full flex-col gap-4 border-t border-white/[0.07] pt-5 text-left @min-[680px]:border-t-0 @min-[680px]:border-l @min-[680px]:pt-0 @min-[680px]:pl-4">
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
                onRelink={onRelinkPdf ? handleRelink : undefined}
                onRemove={handleRemove}
                onClearSearch={() => setSearchQuery('')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(PdfPlaceholder)

import type { PdfFile } from '@shared-core/types'

import { useReadingProgressPersistence } from '@features/pdf'
import type {
  LastReadingInfo,
  PdfTab,
  ReadingProgressUpdate,
  ResumePdfResult
} from '@features/pdf/types'

import { useSharedDragDrop } from '@shared/hooks/useSharedDragDrop'
import { BorderBeam } from '@shared/ui/components/BorderBeam'
import { InlineSpinner } from '@shared/ui/components/primitives'
import ErrorBoundary from '@ui/components/ErrorBoundary'
import { ImportIcon } from '@ui/components/Icons'

import { lazy, memo, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

const PdfViewer = lazy(() => import('@features/pdf/viewer').then((m) => ({ default: m.PdfViewer })))
const PdfTabStrip = lazy(() =>
  import('@features/pdf/viewer').then((m) => ({ default: m.PdfTabStrip }))
)

const GPU_STYLE = {
  border: '1px solid oklch(var(--border) / 0.7)',
  borderRadius: 'var(--radius-2xl)'
}

interface LeftPanelProps {
  onPdfDrop: (file: File) => void
  pdfFile: PdfFile | null
  onSelectPdf: () => void
  onResumePdf?: (path?: string) => Promise<ResumePdfResult> | ResumePdfResult
  onClearResumePdf?: (path?: string) => void
  onRestoreResumePdf?: (info: LastReadingInfo, index?: number) => void
  onRelinkPdf?: (oldPath: string) => Promise<boolean>
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
  initialPage?: number
  activePdfTab?: PdfTab | null
  pdfTabs?: PdfTab[]
  activePdfTabId?: string
  onSetActivePdfTab?: (tabId: string) => void
  onClosePdfTab?: (tabId: string) => void
  onMovePdfTab?: (tabId: string, targetId: string, placeAfter: boolean) => void
  onAddEmptyPdfTab?: () => void
  onPdfHome?: () => void
  isInteractionBlocked?: boolean
  isPanelResizing?: boolean
}

const DropOverlay = ({ isVisible, t }: { isVisible: boolean; t: (key: string) => string }) => {
  if (!isVisible) return null
  return (
    <div className="z-overlay animate-in fade-in motion-normal absolute inset-0 flex items-center justify-center bg-zinc-950/85 p-6 backdrop-blur-xl">
      <div className="relative flex w-full max-w-xs flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-white/25 bg-zinc-950/80 p-6 text-center shadow-2xl backdrop-blur-xl">
        <BorderBeam
          size={100}
          duration={10}
          borderWidth={1}
          colorFrom="#a1a1aa"
          colorTo="#3f3f46"
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-zinc-200">
          <ImportIcon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-ql-13 font-semibold tracking-tight text-zinc-100">
            {t('drop_pdf_title')}
          </h3>
          <p className="text-ql-11 mt-0.5 text-zinc-400">{t('drop_pdf_desc')}</p>
        </div>
      </div>
    </div>
  )
}

function LeftPanel({
  onPdfDrop,
  pdfFile,
  onSelectPdf,
  onResumePdf,
  onClearResumePdf,
  onRestoreResumePdf,
  onRelinkPdf,
  onReadingProgressChange,
  initialPage,
  activePdfTab,
  pdfTabs = [],
  activePdfTabId = '',
  onSetActivePdfTab,
  onClosePdfTab,
  onMovePdfTab,
  onAddEmptyPdfTab,
  onPdfHome,
  isInteractionBlocked,
  isPanelResizing = false
}: LeftPanelProps) {
  const { t } = useTranslation()
  const { recentReadingInfo } = useReadingProgressPersistence()

  const { isDragOver, containerRef, dragHandlers } = useSharedDragDrop((file) => {
    onPdfDrop(file as File)
  })

  return (
    <div className="panel-3d-wrapper flex h-full w-full flex-col">
      <div
        ref={containerRef}
        {...dragHandlers}
        className="glass-tier-1 panel-3d-left relative flex h-full w-full flex-col overflow-hidden transition-[opacity,background-color,border-color] duration-200 ease-out"
        style={GPU_STYLE}
      >
        <DropOverlay isVisible={isDragOver} t={t} />

        <ErrorBoundary title={t('error_pdf_handler')}>
          <div className="relative flex h-full flex-1 flex-col overflow-hidden">
            {pdfTabs?.length > 0 && onSetActivePdfTab && onClosePdfTab && onMovePdfTab && (
              <Suspense fallback={null}>
                <PdfTabStrip
                  tabs={pdfTabs}
                  activeTabId={activePdfTabId}
                  onSetActiveTab={onSetActivePdfTab}
                  onCloseTab={onClosePdfTab}
                  onMoveTab={onMovePdfTab}
                  onAddTab={onAddEmptyPdfTab || onSelectPdf}
                  onHome={onPdfHome}
                />
              </Suspense>
            )}

            <div className="relative flex-1 overflow-hidden">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <InlineSpinner size="xl" className="border-border border-t-primary/60" />
                  </div>
                }
              >
                <div className="animate-in fade-in motion-slower absolute inset-0 h-full w-full">
                  <ErrorBoundary title={t('error_pdf_viewer')}>
                    <PdfViewer
                      pdfFile={pdfFile}
                      activePdfTab={activePdfTab}
                      onSelectPdf={onSelectPdf}
                      t={t}
                      initialPage={initialPage}
                      onResumePdf={onResumePdf}
                      onClearResumePdf={onClearResumePdf}
                      onRestoreResumePdf={onRestoreResumePdf}
                      onRelinkPdf={onRelinkPdf}
                      onReadingProgressChange={onReadingProgressChange}
                      lastReadingInfo={recentReadingInfo}
                      isInteractionBlocked={isInteractionBlocked}
                      isPanelResizing={isPanelResizing}
                    />
                  </ErrorBoundary>
                </div>
              </Suspense>
            </div>
          </div>
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default memo(LeftPanel)

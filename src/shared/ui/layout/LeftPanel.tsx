import type { PdfFile } from '@shared-core/types'

import { useReadingProgressPersistence } from '@features/pdf/hooks/useReadingProgressPersistence'
import type {
  LastReadingInfo,
  PdfTab,
  ReadingProgressUpdate,
  ResumePdfResult
} from '@features/pdf/types'

import { useSharedDragDrop } from '@shared/hooks/useSharedDragDrop'
import ErrorBoundary from '@ui/components/ErrorBoundary'
import { ImportIcon } from '@ui/components/Icons'

import { lazy, memo, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

const PdfViewer = lazy(() => import('@features/pdf/viewer').then((m) => ({ default: m.PdfViewer })))
const PdfTabStrip = lazy(() =>
  import('@features/pdf/viewer').then((m) => ({ default: m.PdfTabStrip }))
)
const PdfWorkerHost = lazy(() =>
  import('@features/pdf/viewer').then((m) => ({ default: m.PdfWorkerHost }))
)

const GPU_STYLE = {
  border: '1px solid oklch(var(--border))',
  borderRadius: 'var(--radius-xl)'
}

interface LeftPanelProps {
  onPdfDrop: (file: File) => void
  pdfFile: PdfFile | null
  onSelectPdf: () => void
  onTextSelection?: (text: string, position: { top: number; left: number } | null) => void
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
  onRenamePdfTab?: (tabId: string, title?: string) => void
  onAddEmptyPdfTab?: () => void
  onPdfHome?: () => void
  isInteractionBlocked?: boolean
  isPanelResizing?: boolean
}

const DropOverlay = ({ isVisible, t }: { isVisible: boolean; t: (key: string) => string }) => {
  if (!isVisible) return null
  return (
    <div className="z-overlay bg-background/60 animate-in fade-in absolute inset-0 flex items-center justify-center p-6 backdrop-blur-md duration-150">
      <div className="border-ring/60 bg-card/90 shadow-ambient-lg flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center">
        <div className="border-primary/20 bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl border">
          <ImportIcon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-foreground text-ql-14 font-semibold">{t('drop_pdf_title')}</h3>
          <p className="text-muted-foreground text-ql-11 mt-0.5">{t('drop_pdf_desc')}</p>
        </div>
      </div>
    </div>
  )
}

function LeftPanel({
  onPdfDrop,
  pdfFile,
  onSelectPdf,
  onTextSelection,
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
  onRenamePdfTab,
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
        className="glass-tier-1 panel-3d-left relative flex h-full w-full flex-col overflow-hidden"
        style={GPU_STYLE}
      >
        <DropOverlay isVisible={isDragOver} t={t} />

        <ErrorBoundary title={t('error_pdf_handler')}>
          <div className="relative flex h-full flex-1 flex-col overflow-hidden">
            {pdfTabs?.length > 0 && onSetActivePdfTab && onClosePdfTab && onRenamePdfTab && (
              <Suspense fallback={null}>
                <PdfTabStrip
                  tabs={pdfTabs}
                  activeTabId={activePdfTabId}
                  onSetActiveTab={onSetActivePdfTab}
                  onCloseTab={onClosePdfTab}
                  onRenameTab={onRenamePdfTab}
                  onAddTab={onAddEmptyPdfTab || onSelectPdf}
                  onHome={onPdfHome}
                />
              </Suspense>
            )}

            <div className="relative flex-1 overflow-hidden">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <div className="border-border border-t-primary/60 h-8 w-8 animate-spin rounded-full border-2" />
                  </div>
                }
              >
                <div className="animate-in fade-in absolute inset-0 h-full w-full duration-300">
                  <ErrorBoundary title={t('error_pdf_viewer')}>
                    <PdfWorkerHost>
                      <PdfViewer
                        pdfFile={pdfFile}
                        activePdfTab={activePdfTab}
                        onSelectPdf={onSelectPdf}
                        onTextSelection={onTextSelection}
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
                    </PdfWorkerHost>
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

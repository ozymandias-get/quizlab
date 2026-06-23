import type { PdfFile } from '@shared-core/types'

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
  boxShadow: `
    0 24px 48px -12px oklch(0 0 0 / 0.75),
    0 0 60px -15px oklch(0.6 0.08 75 / 0.10),
    inset 0 1px 1px oklch(1 0 0 / 0.20)
  `,
  border: '1px solid oklch(var(--border))',
  borderRadius: 'var(--radius-2xl)'
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
  lastReadingInfo?: LastReadingInfo[] | null
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
    <div className="z-overlay bg-background/60 animate-in fade-in absolute inset-0 flex items-center justify-center backdrop-blur-md duration-200">
      <div className="border-border bg-card flex flex-col items-center gap-4 rounded-2xl border p-8 shadow-2xl">
        <ImportIcon className="text-primary h-8 w-8" />
        <div className="text-center">
          <h3 className="text-foreground text-sm font-semibold">{t('drop_pdf_title')}</h3>
          <p className="text-muted-foreground mt-1 text-xs">{t('drop_pdf_desc')}</p>
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
  lastReadingInfo,
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
                        lastReadingInfo={lastReadingInfo}
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

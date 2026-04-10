import { memo, Suspense, lazy, useMemo } from 'react'
import { useLanguageStrings } from '@app/providers/LanguageContext'
import type { PdfFile } from '@shared-core/types'
import ErrorBoundary from '@ui/components/ErrorBoundary'
import { useSharedDragDrop } from '@shared/hooks/useSharedDragDrop'
import { ImportIcon, LoaderIcon } from '@ui/components/Icons'
import { PdfTabStrip } from '@features/pdf'
import type { PdfTab, LastReadingInfo, ResumePdfResult, ReadingProgressUpdate } from '@features/pdf'
import { Worker } from '@react-pdf-viewer/core'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

const PdfViewer = lazy(() => import('@features/pdf').then((m) => ({ default: m.PdfViewer })))

/** Stable across tab switches; changes when document identity or viewerSessionKey bumps. Exported for tests. */
export function getPdfViewerRemountKey(
  activePdfTab: PdfTab | null | undefined,
  pdfFile: PdfFile | null
): string {
  if (activePdfTab?.kind === 'drive') return 'drive'
  if (!pdfFile) return 'empty'
  const path = pdfFile.path ?? ''
  const stream = pdfFile.streamUrl ?? ''
  const session = activePdfTab?.viewerSessionKey ?? ''
  return `${session}|${path}|${stream}`
}

interface LeftPanelProps {
  onPdfDrop: (file: File) => void
  pdfFile: PdfFile | null
  onSelectPdf: () => void
  onTextSelection?: (text: string, position: { top: number; left: number } | null) => void
  onResumePdf?: (path?: string) => Promise<ResumePdfResult> | ResumePdfResult
  onClearResumePdf?: (path?: string) => void
  onRestoreResumePdf?: (info: LastReadingInfo, index?: number) => void
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
  onOpenGoogleDrive?: () => void
  onPdfHome?: () => void
  isInteractionBlocked?: boolean
  isPanelResizing?: boolean
}

const DropOverlay = ({ isVisible, t }: { isVisible: boolean; t: (key: string) => string }) => {
  if (!isVisible) return null
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-stone-800 border-2 border-dashed border-emerald-500/50 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
          <ImportIcon className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h3 className="text-emerald-400 font-bold text-ql-20">{t('drop_pdf_title')}</h3>
          <p className="text-stone-400 text-ql-14 mt-1">{t('drop_pdf_desc')}</p>
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
  onOpenGoogleDrive,
  onPdfHome,
  isInteractionBlocked,
  isPanelResizing = false
}: LeftPanelProps) {
  const { t } = useLanguageStrings()

  const { isDragOver, containerRef, dragHandlers } = useSharedDragDrop((file) => {
    onPdfDrop(file as File)
  })

  const pdfViewerRemountKey = useMemo(
    () => getPdfViewerRemountKey(activePdfTab, pdfFile),
    [activePdfTab?.kind, activePdfTab?.viewerSessionKey, pdfFile?.path, pdfFile?.streamUrl]
  )

  return (
    <div
      ref={containerRef}
      {...dragHandlers}
      className="glass-tier-1 h-full w-full flex flex-col overflow-hidden relative"
      style={{
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
      }}
    >
      <DropOverlay isVisible={isDragOver} t={t} />

      <ErrorBoundary title={t('error_pdf_handler')}>
        <div className="flex-1 overflow-hidden relative h-full flex flex-col">
          {pdfTabs?.length > 0 && onSetActivePdfTab && onClosePdfTab && onRenamePdfTab && (
            <PdfTabStrip
              tabs={pdfTabs}
              activeTabId={activePdfTabId}
              onSetActiveTab={onSetActivePdfTab}
              onCloseTab={onClosePdfTab}
              onRenameTab={onRenamePdfTab}
              onAddTab={onAddEmptyPdfTab || onSelectPdf}
              onHome={onPdfHome}
            />
          )}

          <div className="relative flex-1 overflow-hidden">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <LoaderIcon className="w-8 h-8 text-amber-500" />
                </div>
              }
            >
              <div className="absolute inset-0 w-full h-full animate-in fade-in duration-300">
                <ErrorBoundary title={t('error_pdf_viewer')}>
                  <Worker workerUrl={pdfjsWorkerUrl}>
                    <PdfViewer
                      key={pdfViewerRemountKey}
                      pdfFile={pdfFile}
                      activePdfTab={activePdfTab}
                      onSelectPdf={onSelectPdf}
                      onTextSelection={onTextSelection}
                      t={t}
                      initialPage={initialPage}
                      onResumePdf={onResumePdf}
                      onClearResumePdf={onClearResumePdf}
                      onRestoreResumePdf={onRestoreResumePdf}
                      onReadingProgressChange={onReadingProgressChange}
                      lastReadingInfo={lastReadingInfo}
                      onOpenGoogleDrive={onOpenGoogleDrive}
                      isInteractionBlocked={isInteractionBlocked}
                      isPanelResizing={isPanelResizing}
                    />
                  </Worker>
                </ErrorBoundary>
              </div>
            </Suspense>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  )
}

export default memo(LeftPanel)

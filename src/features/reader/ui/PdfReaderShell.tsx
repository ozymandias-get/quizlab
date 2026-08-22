import type { PdfFile } from '@shared-core/types'

import { useDoclingModelsDownload } from '@platform/electron/api/useDoclingModelsApi'
import { useOptionalComponents } from '@platform/electron/api/useOptionalComponentsApi'

import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'
import type {
  LastReadingInfo,
  PdfTab,
  ReadingProgressUpdate,
  ResumePdfResult
} from '@features/pdf/types'
import PdfViewer from '@features/pdf/ui/components/PdfViewer'
import { useDocumentConversion } from '@features/reader/hooks/useDocumentConversion'
import { useReaderViewMode } from '@features/reader/hooks/useReaderViewMode'

import { InlineSpinner } from '@shared/ui/components/primitives'

import { memo, useEffect } from 'react'

import DoclingInstallCta from './DoclingInstallCta'
import ReaderView from './ReaderView'
import ViewModeToggle from './ViewModeToggle'

interface Props {
  pdfFile: PdfFile | null
  activePdfTab?: PdfTab | null
  onSelectPdf: () => void
  onTextSelection?: (text: string, position: { top: number; left: number } | null) => void
  t: (key: string) => string
  initialPage?: number
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
  lastReadingInfo?: LastReadingInfo[] | null
  onResumePdf?: (path?: string) => Promise<ResumePdfResult> | ResumePdfResult
  onClearResumePdf?: (path?: string) => void
  onRestoreResumePdf?: (info: LastReadingInfo, index?: number) => void
  onRelinkPdf?: (oldPath: string) => Promise<boolean>
  isInteractionBlocked?: boolean
  isPanelResizing?: boolean
}

const PdfReaderShell = memo(function PdfReaderShell(props: Props) {
  const { pdfFile, activePdfTab } = props
  const { viewMode, setViewMode } = useReaderViewMode(activePdfTab?.id)

  const showToggle = !!pdfFile
  const { data: components } = useOptionalComponents()
  const docling = components?.find((c) => c.id === 'docling')
  const isInstalled = docling?.status === 'installed'
  const pdfPath = pdfFile?.path ?? null
  const { document, isConverting, error, retry, reprocess } = useDocumentConversion(
    viewMode === 'reader' && isInstalled ? pdfPath : null
  )
  const downloadModels = useDoclingModelsDownload()
  const pendingJumpPage = usePdfTabStore(
    (s) => s.pdfTabs.find((t) => t.id === activePdfTab?.id)?.pendingJumpPage ?? null
  )
  const setPendingJumpPage = usePdfTabStore((s) => s.setPendingJumpPage)

  useEffect(() => {
    if (downloadModels.isSuccess) retry()
  }, [downloadModels.isSuccess, retry])

  let readerContent: React.ReactNode = null
  if (viewMode === 'reader' && pdfFile) {
    if (!isInstalled) {
      readerContent = (
        <div className="flex h-full items-center justify-center p-6">
          <DoclingInstallCta
            onContinuePdf={() => setViewMode('pdf')}
            onInstalled={() => setViewMode('reader')}
          />
        </div>
      )
    } else if (isConverting) {
      readerContent = (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
          <InlineSpinner />
          <span className="text-muted-foreground text-ql-13">Akıllı okuma hazırlanıyor…</span>
        </div>
      )
    } else if (error) {
      const isModelMissing = error.toLowerCase().includes('model')
      const msg = isModelMissing
        ? 'Gerekli belge modelleri yüklü değil.'
        : error === 'conversion_timeout'
          ? 'Dönüşüm zaman aşımına uğradı'
          : error === 'encrypted_pdf'
            ? 'Şifreli PDF desteklenmiyor'
            : error === 'corrupted_pdf'
              ? 'Bozuk PDF'
              : error
      readerContent = (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-destructive text-ql-13">{msg}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {isModelMissing ? (
              <button
                type="button"
                onClick={() => downloadModels.mutate()}
                disabled={downloadModels.isPending}
                className="bg-primary text-primary-foreground text-ql-12 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5"
              >
                {downloadModels.isPending ? 'İndiriliyor…' : 'Modelleri İndir'}
              </button>
            ) : (
              <button
                type="button"
                onClick={retry}
                className="bg-primary text-primary-foreground text-ql-12 rounded-lg px-3 py-1.5"
              >
                Yeniden dene
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewMode('pdf')}
              className="border-border bg-card text-ql-12 rounded-lg border px-3 py-1.5"
            >
              PDF ile devam et
            </button>
          </div>
          <p className="text-muted-foreground text-ql-11">
            {isModelMissing
              ? 'İndirme bitince belge yeniden işlenecek. Offline için modeller gerekli.'
              : 'PDF görünümü çalışmaya devam ediyor'}
          </p>
        </div>
      )
    } else if (document) {
      readerContent = (
        <div className="h-full overflow-y-auto overscroll-contain">
          <ReaderView document={document} onReprocess={reprocess} />
        </div>
      )
    } else {
      readerContent = (
        <div className="flex h-full items-center justify-center p-8">
          <InlineSpinner />
        </div>
      )
    }
  }

  const handleTargetConsumed = () => {
    if (activePdfTab?.id) setPendingJumpPage(activePdfTab.id, null)
  }

  return (
    <div className="flex h-full flex-col">
      {showToggle && (
        <div className="border-border/60 bg-card/40 flex shrink-0 justify-center border-b px-3 py-2">
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      )}
      <div className="relative flex-1 overflow-hidden">
        {viewMode === 'reader' && pdfFile ? (
          readerContent
        ) : (
          <PdfViewer
            {...props}
            targetPage={pendingJumpPage}
            onTargetPageConsumed={handleTargetConsumed}
          />
        )}
      </div>
    </div>
  )
})

export default PdfReaderShell

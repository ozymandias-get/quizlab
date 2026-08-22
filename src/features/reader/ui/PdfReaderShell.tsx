import type { PdfFile } from '@shared-core/types'

import type {
  LastReadingInfo,
  PdfTab,
  ReadingProgressUpdate,
  ResumePdfResult
} from '@features/pdf/types'
import PdfViewer from '@features/pdf/ui/components/PdfViewer'
import { useReaderViewMode } from '@features/reader/hooks/useReaderViewMode'

import { memo } from 'react'

import ReaderPlaceholder from './ReaderPlaceholder'
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

  // No document yet: delegate to PdfViewer's placeholder (which already shows the open UI).
  // We keep the placeholder logic inside PdfViewer to avoid duplicating recent list.
  // When a PDF is present, we show the toggle and switch views.
  const showToggle = !!pdfFile

  return (
    <div className="flex h-full flex-col">
      {showToggle && (
        <div className="border-border/60 bg-card/40 flex shrink-0 justify-center border-b px-3 py-2">
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      )}
      <div className="relative flex-1 overflow-hidden">
        {viewMode === 'reader' && pdfFile ? (
          <ReaderPlaceholder
            onContinuePdf={() => setViewMode('pdf')}
            onInstalled={() => setViewMode('reader')}
          />
        ) : (
          <PdfViewer {...props} />
        )}
      </div>
    </div>
  )
})

export default PdfReaderShell

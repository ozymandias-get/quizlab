import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/page-navigation/lib/styles/index.css'
import '@react-pdf-viewer/zoom/lib/styles/index.css'
import '@react-pdf-viewer/search/lib/styles/index.css'

import { GOOGLE_DRIVE_WEB_APP } from '@shared-core/constants/google-ai-web-apps'
import type { PdfFile } from '@shared-core/types'

import { revokeObjectUrl } from '@platform/electron/browser-api-utils'

import type {
  LastReadingInfo,
  PdfTab,
  ReadingProgressUpdate,
  ResumePdfResult
} from '@features/pdf/hooks/types'

import {
  useAiRegistryMeta,
  useAiSessionActions,
  useAiSessionUiPrefsState
} from '@app/providers/AiContext'
import { useAppToolActions } from '@app/providers/AppToolContext'

import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import GoogleDrivePanel from './GoogleDrivePanel'
import PdfPlaceholder from './PdfPlaceholder'
import PdfViewerDocument from './PdfViewerDocument'

interface PdfViewerProps {
  pdfFile: PdfFile | null
  activePdfTab?: PdfTab | null
  onSelectPdf: () => void
  onTextSelection?: (text: string, position: { top: number; left: number } | null) => void
  t?: (key: string) => string
  initialPage?: number
  onResumePdf?: (path?: string) => Promise<ResumePdfResult> | ResumePdfResult
  onClearResumePdf?: (path?: string) => void
  onRestoreResumePdf?: (info: LastReadingInfo, index?: number) => void
  onRelinkPdf?: (oldPath: string) => Promise<boolean>
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
  lastReadingInfo?: LastReadingInfo[] | null
  isInteractionBlocked?: boolean
  isPanelResizing?: boolean
}

function PdfViewer({
  pdfFile,
  activePdfTab,
  onSelectPdf,
  onTextSelection,
  t: propT,
  initialPage,
  onResumePdf,
  onClearResumePdf,
  onRestoreResumePdf,
  onRelinkPdf,
  onReadingProgressChange,
  lastReadingInfo,
  isInteractionBlocked = false,
  isPanelResizing = false
}: PdfViewerProps) {
  const { chromeUserAgent } = useAiRegistryMeta()
  const { autoSend } = useAiSessionUiPrefsState()
  const { toggleAutoSend } = useAiSessionActions()
  const { startScreenshot, queueImageForAi } = useAppToolActions()
  const { t: contextT } = useTranslation()
  const t = propT || contextT || ((k: string) => k)

  const [persistentFile, setPersistentFile] = useState<PdfFile | null>(null)
  const [persistentUrl, setPersistentUrl] = useState<string | null | undefined>(null)
  const [persistentInitialPage, setPersistentInitialPage] = useState<number | undefined>(undefined)
  const [hasEverLoaded, setHasEverLoaded] = useState(false)

  useEffect(() => {
    if (pdfFile) {
      if (
        persistentUrl &&
        persistentUrl.startsWith('blob:') &&
        persistentUrl !== pdfFile.streamUrl
      ) {
        revokeObjectUrl(persistentUrl)
      }

      setPersistentFile(pdfFile)
      setPersistentUrl(pdfFile.streamUrl)
      setPersistentInitialPage(initialPage)
      setHasEverLoaded(true)
    } else {
      // Tab closed — clear persistent state so the viewer unloads immediately.
      // No closing animation: it caused a "stuck UI" feeling and momentary
      // zoom glitch. The placeholder fades in via its own CSS animation.
      setPersistentFile(null)
      setPersistentUrl(null)
      setPersistentInitialPage(undefined)
    }
  }, [pdfFile, initialPage])

  const isViewerVisible = !!pdfFile && activePdfTab?.kind !== 'drive'

  return (
    <div className="relative h-full w-full">
      {hasEverLoaded && persistentFile && persistentUrl && (
        <div
          className="absolute inset-0 h-full w-full"
          style={{ display: isViewerVisible ? 'block' : 'none' }}
        >
          <PdfViewerDocument
            pdfFile={persistentFile}
            pdfUrl={persistentUrl}
            activePdfTab={activePdfTab}
            onTextSelection={onTextSelection}
            t={t}
            initialPage={persistentInitialPage}
            onReadingProgressChange={onReadingProgressChange}
            isInteractionBlocked={isInteractionBlocked || !pdfFile}
            autoSend={autoSend}
            onToggleAutoSend={toggleAutoSend}
            startScreenshot={startScreenshot}
            queueImageForAi={queueImageForAi}
            isPanelResizing={isPanelResizing}
          />
        </div>
      )}

      {activePdfTab?.kind === 'drive' && (
        <GoogleDrivePanel
          tabId={activePdfTab.id}
          webviewUrl={activePdfTab.webviewUrl || GOOGLE_DRIVE_WEB_APP.url}
          chromeUserAgent={chromeUserAgent}
          title={GOOGLE_DRIVE_WEB_APP.name}
          description={t('gdrive_pdf_desc')}
          reloadLabel={t('ctx_reload')}
          isInteractionBlocked={isInteractionBlocked}
        />
      )}

      {!isViewerVisible && activePdfTab?.kind !== 'drive' && (
        <div className="bg-background animate-in fade-in absolute inset-0 h-full w-full duration-150">
          <PdfPlaceholder
            onSelectPdf={onSelectPdf}
            onResumePdf={onResumePdf}
            onClearResumePdf={onClearResumePdf}
            onRestoreResumePdf={onRestoreResumePdf}
            onRelinkPdf={onRelinkPdf}
            lastReadingInfo={lastReadingInfo}
          />
        </div>
      )}
    </div>
  )
}

function pdfFileKey(a: PdfFile | null): string | null {
  return a ? `${a.path}::${a.streamUrl}::${a.name}::${a.size}` : null
}

export default memo(PdfViewer, (prev, next) => {
  if (pdfFileKey(prev.pdfFile) !== pdfFileKey(next.pdfFile)) return false
  if (prev.initialPage !== next.initialPage) return false
  if (prev.activePdfTab?.kind !== next.activePdfTab?.kind) return false
  if (prev.isInteractionBlocked !== next.isInteractionBlocked) return false
  return true
})

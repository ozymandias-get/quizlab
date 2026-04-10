import { memo } from 'react'
import { useLocalStorage } from '@shared/hooks'
import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'
import {
  useAiRegistryMeta,
  useAiCoreWorkspaceActions,
  useAiSessionUiPrefsState
} from '@app/providers/AiContext'
import { useAppToolActions } from '@app/providers/AppToolContext'
import { useLanguageStrings } from '@app/providers/LanguageContext'
import {
  DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS,
  GOOGLE_DRIVE_WEB_APP
} from '@shared-core/constants/google-ai-web-apps'

import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/page-navigation/lib/styles/index.css'
import '@react-pdf-viewer/zoom/lib/styles/index.css'
import '@react-pdf-viewer/search/lib/styles/index.css'

import GoogleDrivePanel from './GoogleDrivePanel'
import PdfPlaceholder from './PdfPlaceholder'
import PdfViewerDocument from './PdfViewerDocument'

import type { PdfFile } from '@shared-core/types'
import type { LastReadingInfo, ReadingProgressUpdate } from '@features/pdf/hooks/usePdfSelection'
import type { PdfTab, ResumePdfResult } from '@features/pdf/hooks/usePdfSelection'

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
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
  lastReadingInfo?: LastReadingInfo[] | null
  onOpenGoogleDrive?: () => void
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
  onReadingProgressChange,
  lastReadingInfo,
  onOpenGoogleDrive,
  isInteractionBlocked = false,
  isPanelResizing = false
}: PdfViewerProps) {
  const { chromeUserAgent } = useAiRegistryMeta()
  const { autoSend } = useAiSessionUiPrefsState()
  const { toggleAutoSend } = useAiCoreWorkspaceActions()
  const { startScreenshot, queueImageForAi } = useAppToolActions()
  const { t: contextT } = useLanguageStrings()
  const { data: webSessionData } = useGeminiWebStatus()
  const [enabledGoogleApps] = useLocalStorage<string[]>(
    'gwsEnabledApps',
    DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS
  )
  const t = propT || contextT || ((k: string) => k)

  const pdfUrl = pdfFile?.streamUrl
  const isGoogleDriveEnabled =
    !!webSessionData?.featureEnabled &&
    !!webSessionData?.enabled &&
    Array.isArray(enabledGoogleApps) &&
    enabledGoogleApps.includes('gdrive')

  if (activePdfTab?.kind === 'drive') {
    return (
      <GoogleDrivePanel
        tabId={activePdfTab.id}
        webviewUrl={activePdfTab.webviewUrl || GOOGLE_DRIVE_WEB_APP.url}
        chromeUserAgent={chromeUserAgent}
        title={GOOGLE_DRIVE_WEB_APP.name}
        description={t('gdrive_pdf_desc')}
        reloadLabel={t('ctx_reload')}
        isInteractionBlocked={isInteractionBlocked}
      />
    )
  }

  if (!pdfUrl || !pdfFile) {
    return (
      <PdfPlaceholder
        onSelectPdf={onSelectPdf}
        onResumePdf={onResumePdf}
        onClearResumePdf={onClearResumePdf}
        onRestoreResumePdf={onRestoreResumePdf}
        lastReadingInfo={lastReadingInfo}
        onOpenGoogleDrive={isGoogleDriveEnabled ? onOpenGoogleDrive : undefined}
      />
    )
  }

  return (
    <PdfViewerDocument
      pdfFile={pdfFile}
      pdfUrl={pdfUrl}
      activePdfTab={activePdfTab}
      onSelectPdf={onSelectPdf}
      onTextSelection={onTextSelection}
      t={t}
      initialPage={initialPage}
      onReadingProgressChange={onReadingProgressChange}
      isInteractionBlocked={isInteractionBlocked}
      autoSend={autoSend}
      onToggleAutoSend={toggleAutoSend}
      startScreenshot={startScreenshot}
      queueImageForAi={queueImageForAi}
      isPanelResizing={isPanelResizing}
    />
  )
}

export default memo(PdfViewer)

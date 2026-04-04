import {
  useRef,
  useState,
  memo,
  useEffect,
  useMemo,
  type CSSProperties,
  type WheelEvent
} from 'react'
import { useLocalStorage } from '@shared/hooks'
import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'
import { useAiActions, useAiState } from '@app/providers/AiContext'
import { useAppToolActions } from '@app/providers/AppToolContext'
import { useLanguage } from '@app/providers/LanguageContext'
import { Maximize, Crop, ZoomIn, ZoomOut, RotateCcw, RefreshCw } from 'lucide-react'
import {
  DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS,
  GOOGLE_DRIVE_WEB_APP
} from '@shared-core/constants/google-ai-web-apps'

import { Viewer, SpecialZoomLevel, ScrollMode, LoadError } from '@react-pdf-viewer/core'

import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/page-navigation/lib/styles/index.css'
import '@react-pdf-viewer/zoom/lib/styles/index.css'
import '@react-pdf-viewer/search/lib/styles/index.css'

import GoogleDrivePanel from './GoogleDrivePanel'
import PdfPlaceholder from './PdfPlaceholder'
import PdfToolbar from './PdfToolbar'
import { ContextMenu, MenuItem } from './ContextMenu'

import {
  usePdfPlugins,
  usePdfNavigation,
  usePdfTextSelection,
  usePdfScreenshot,
  usePdfContextMenu,
  usePdfPanTool
} from '../hooks'
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
  isInteractionBlocked = false
}: PdfViewerProps) {
  const { autoSend, chromeUserAgent } = useAiState()
  const { toggleAutoSend } = useAiActions()
  const { startScreenshot, queueImageForAi } = useAppToolActions()
  const { t: contextT } = useLanguage()
  const { data: webSessionData } = useGeminiWebStatus()
  const [enabledGoogleApps] = useLocalStorage<string[]>(
    'gwsEnabledApps',
    DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS
  )
  const t = propT || contextT || ((k: string) => k)

  const containerRef = useRef<HTMLDivElement>(null)
  const [scaleFactor, setScaleFactor] = useState(1)
  const [viewerReloadKey, setViewerReloadKey] = useState(0)
  const [panMode, setPanMode] = useState(false)

  const pdfUrl = pdfFile?.streamUrl
  const isGoogleDriveEnabled =
    !!webSessionData?.featureEnabled &&
    !!webSessionData?.enabled &&
    enabledGoogleApps.includes('gdrive')

  const {
    plugins,
    jumpToPageRef,
    ZoomIn: PluginZoomIn,
    ZoomOut: PluginZoomOut,
    zoomTo,
    CurrentScale,
    highlight,
    clearHighlights
  } = usePdfPlugins()

  const {
    currentPage,
    totalPages,
    handlePageChange,
    handleDocumentLoad,
    goToPreviousPage,
    goToNextPage
  } = usePdfNavigation({
    containerRef,
    jumpToPageRef,
    pdfPath: pdfFile?.path || null,
    initialPage,
    onReadingProgressChange
  })

  const { handleFullPageScreenshot } = usePdfScreenshot({
    currentPage,
    queueImageForAi,
    startScreenshot
  })

  const { isDragging: isPanDragging } = usePdfPanTool({
    containerRef,
    isPanMode: panMode
  })

  usePdfTextSelection({
    containerRef,
    onTextSelection: onTextSelection || (() => {}),
    enabled: !isInteractionBlocked && activePdfTab?.kind !== 'drive' && !!pdfUrl && !panMode
  })

  const { contextMenu, setContextMenu } = usePdfContextMenu(containerRef)

  useEffect(() => {
    setViewerReloadKey(0)
  }, [pdfUrl])

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        label: t('ctx_full_page_screenshot'),
        icon: Maximize,
        onClick: handleFullPageScreenshot,
        shortcut: 'Ctrl+S'
      },
      {
        label: t('ctx_crop_screenshot'),
        icon: Crop,
        onClick: () =>
          startScreenshot({
            page: currentPage,
            captureKind: 'selection'
          }),
        shortcut: 'Shift+S'
      },
      { separator: true, label: '', onClick: () => {} },
      {
        label: t('ctx_zoom_in'),
        icon: ZoomIn,
        onClick: () => zoomTo(scaleFactor + 0.1),
        shortcut: 'Ctrl+'
      },
      {
        label: t('ctx_zoom_out'),
        icon: ZoomOut,
        onClick: () => zoomTo(Math.max(0.1, scaleFactor - 0.1)),
        shortcut: 'Ctrl-'
      },
      {
        label: t('ctx_reset_zoom'),
        icon: RotateCcw,
        onClick: () => zoomTo(SpecialZoomLevel.PageWidth),
        shortcut: 'Ctrl+0'
      },
      { separator: true, label: '', onClick: () => {} },
      {
        label: t('ctx_reload'),
        icon: RefreshCw,
        onClick: () => setViewerReloadKey((current) => current + 1),
        shortcut: 'Ctrl+R',
        danger: true
      }
    ],
    [t, handleFullPageScreenshot, startScreenshot, zoomTo, scaleFactor, currentPage]
  )

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

  if (!pdfUrl) {
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
    <div className="flex-1 flex flex-col overflow-hidden h-full min-h-0">
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden pdf-viewer-container h-full min-h-0 relative flex flex-col${
          panMode ? ' pdf-pan-mode-active' : ''
        }${isPanDragging ? ' pdf-pan-mode-dragging' : ''}`}
        style={{ '--scale-factor': scaleFactor } as CSSProperties}
        onWheel={(e: WheelEvent<HTMLDivElement>) => {
          if (e.ctrlKey || e.metaKey) {
            return
          }
        }}
      >
        <Viewer
          key={`${pdfUrl}:${viewerReloadKey}`}
          fileUrl={pdfUrl}
          plugins={plugins}
          defaultScale={SpecialZoomLevel.PageWidth}
          initialPage={initialPage && initialPage > 1 ? initialPage - 1 : 0}
          scrollMode={ScrollMode.Page}
          onPageChange={handlePageChange}
          onDocumentLoad={handleDocumentLoad}
          onZoom={(e) => setScaleFactor(e.scale)}
          transformGetDocumentParams={(params) => ({
            ...params,
            isEvalSupported: false
          })}
          renderError={(error: LoadError) => (
            <div className="flex items-center justify-center h-full text-red-500 p-8 text-center bg-stone-950/50 backdrop-blur-sm">
              <p>
                {t('pdf_load_error')}: {error.message || t('error_unknown_error')}
              </p>
            </div>
          )}
          renderPage={(props) => (
            <>
              {props.canvasLayer.children}
              {props.textLayer.children}
              {props.annotationLayer.children}
            </>
          )}
          theme={{
            theme: 'dark'
          }}
        />

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={menuItems}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>

      <PdfToolbar
        pdfFile={pdfFile}
        onSelectPdf={onSelectPdf}
        onStartScreenshot={() =>
          startScreenshot({
            page: currentPage,
            captureKind: 'selection'
          })
        }
        onFullPageScreenshot={handleFullPageScreenshot}
        autoSend={autoSend}
        onToggleAutoSend={toggleAutoSend}
        panMode={panMode}
        onTogglePanMode={() => setPanMode((v) => !v)}
        currentPage={currentPage}
        totalPages={totalPages}
        onPreviousPage={goToPreviousPage}
        onNextPage={goToNextPage}
        highlight={highlight}
        clearHighlights={clearHighlights}
        ZoomIn={PluginZoomIn}
        ZoomOut={PluginZoomOut}
        CurrentScale={CurrentScale}
      />
    </div>
  )
}

export default memo(PdfViewer)

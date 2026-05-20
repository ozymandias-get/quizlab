import { useRef, useState, memo, useEffect, useMemo, useCallback } from 'react'
import { Crop, RefreshCw, Type, Image as ImageIcon } from 'lucide-react'
import {
  Viewer,
  SpecialZoomLevel,
  ScrollMode,
  LoadError,
  ViewMode,
  Worker
} from '@react-pdf-viewer/core'

import PdfToolbar from './PdfToolbar'
import { ContextMenu, MenuItem } from './ContextMenu'

import {
  usePdfPlugins,
  usePdfNavigation,
  usePdfTextSelection,
  usePdfScreenshot,
  usePdfContextMenu,
  usePdfPanTool,
  usePdfResizeRefit,
  usePdfCtrlWheelZoom,
  usePdfViewerZoomIpc,
  usePdfPageTextExtraction
} from '../hooks'
import type { AiDraftImageItem } from '@app/providers/ai/types'
import type { PdfFile } from '@shared-core/types'
import type { ReadingProgressUpdate } from '@features/pdf/hooks/usePdfSelection'
import type { PdfTab } from '@features/pdf/hooks/usePdfSelection'
import { useAppToolActions } from '@app/providers/AppToolContext'
import { useToastActions } from '@app/providers/ToastContext'
import { useLanguageStrings } from '@app/providers/LanguageContext'

type ScreenshotMeta = Pick<AiDraftImageItem, 'page' | 'captureKind'>

export interface PdfViewerDocumentProps {
  pdfFile: PdfFile
  pdfUrl: string
  activePdfTab?: PdfTab | null
  onSelectPdf: () => void
  onTextSelection?: (text: string, position: { top: number; left: number } | null) => void
  t: (key: string) => string
  initialPage?: number
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
  isInteractionBlocked: boolean
  autoSend: boolean
  onToggleAutoSend: () => void
  startScreenshot: (imageMeta?: ScreenshotMeta) => void
  queueImageForAi: (dataUrl: string, imageMeta?: ScreenshotMeta) => void
  isPanelResizing?: boolean
  workerUrl: string
}

function PdfViewerDocument({
  pdfFile,
  pdfUrl,
  activePdfTab,
  onSelectPdf,
  onTextSelection,
  t,
  initialPage,
  onReadingProgressChange,
  isInteractionBlocked,
  autoSend,
  onToggleAutoSend,
  startScreenshot,
  queueImageForAi,
  isPanelResizing = false,
  workerUrl
}: PdfViewerDocumentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const currentPageRef = useRef(0)
  const [scaleFactor, setScaleFactor] = useState(1)
  const [viewerReloadKey, setViewerReloadKey] = useState(0)
  const [panMode, setPanMode] = useState(false)
  const appliedResumeSyncKeyRef = useRef<string | null>(null)

  const { queueTextForAi } = useAppToolActions()
  const { showSuccess, showWarning } = useToastActions()
  const { t: tt } = useLanguageStrings()

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

  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  const documentReady = totalPages > 0

  usePdfResizeRefit(containerRef, zoomTo, documentReady && !!pdfUrl, isPanelResizing)

  usePdfCtrlWheelZoom(containerRef, zoomTo, scaleFactor, documentReady && !!pdfUrl, panMode)

  usePdfViewerZoomIpc(zoomTo, scaleFactor, documentReady && !!pdfUrl)

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
    onTextSelection: (text, position) => {
      onTextSelection?.(text, position)
    },
    enabled: !isInteractionBlocked && activePdfTab?.kind !== 'drive' && !!pdfUrl && !panMode
  })

  const { contextMenu, setContextMenu } = usePdfContextMenu(containerRef)

  const { extractCurrentPageText } = usePdfPageTextExtraction({
    currentPage,
    onTextExtracted: (text) => {
      queueTextForAi(text)
      showSuccess(tt('pdf_text_added_to_ai'))
    },
    onNoTextFound: () => {
      showWarning(tt('pdf_no_text_found'), undefined, undefined, 4000)
    }
  })

  useEffect(() => {
    setViewerReloadKey(0)
  }, [pdfUrl])

  useEffect(() => {
    if (!documentReady || !pdfUrl || !initialPage || initialPage < 2) {
      return
    }

    const syncKey = `${pdfUrl}:${viewerReloadKey}:${initialPage}`
    if (appliedResumeSyncKeyRef.current === syncKey) {
      return
    }

    appliedResumeSyncKeyRef.current = syncKey
    zoomTo(SpecialZoomLevel.PageWidth)
    jumpToPageRef.current(initialPage - 1)
  }, [documentReady, initialPage, jumpToPageRef, pdfUrl, viewerReloadKey, zoomTo])

  const handleAddCurrentPageTextToAi = useCallback(() => {
    extractCurrentPageText()
  }, [extractCurrentPageText])

  const handleSendPageAsImageToAi = useCallback(() => {
    handleFullPageScreenshot()
  }, [handleFullPageScreenshot])

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        label: tt('pdf_add_current_page_text_to_ai'),
        icon: Type,
        onClick: handleAddCurrentPageTextToAi
      },
      {
        label: tt('pdf_send_page_as_image'),
        icon: ImageIcon,
        onClick: handleSendPageAsImageToAi
      },
      {
        label: tt('ctx_crop_screenshot_ai'),
        icon: Crop,
        onClick: () =>
          startScreenshot({
            page: currentPage,
            captureKind: 'selection'
          })
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
    [t, tt, handleAddCurrentPageTextToAi, handleSendPageAsImageToAi, startScreenshot, currentPage]
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full min-h-0">
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden pdf-viewer-container h-full min-h-0 relative flex flex-col${
          panMode ? ' pdf-pan-mode-active' : ''
        }${isPanDragging ? ' pdf-pan-mode-dragging' : ''}`}
      >
        <Worker workerUrl={workerUrl}>
          <Viewer
            key={`${pdfUrl}:${viewerReloadKey}`}
            fileUrl={pdfUrl}
            plugins={plugins}
            defaultScale={SpecialZoomLevel.PageWidth}
            initialPage={initialPage && initialPage > 1 ? initialPage - 1 : 0}
            scrollMode={ScrollMode.Page}
            viewMode={ViewMode.SinglePage}
            onPageChange={handlePageChange}
            onDocumentLoad={handleDocumentLoad}
            onZoom={(e) => setScaleFactor(e.scale)}
            transformGetDocumentParams={(params) => ({
              ...params,
              isEvalSupported: false
            })}
            renderLoader={() => (
              <div
                data-pdf-page-loader
                className="flex h-full min-h-[12rem] w-full items-center justify-center bg-transparent"
              >
                <div
                  className="h-9 w-9 rounded-full border-2 border-amber-500/25 border-t-amber-500 animate-spin"
                  role="status"
                  aria-label="Loading"
                />
              </div>
            )}
            renderError={(error: LoadError) => (
              <div className="flex items-center justify-center h-full text-red-500 p-8 text-center bg-stone-950/50 backdrop-blur-sm">
                <p>
                  {t('pdf_load_error')}: {error.message || t('error_unknown_error')}
                </p>
              </div>
            )}
            theme={{
              theme: 'dark'
            }}
          />
        </Worker>

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
        onToggleAutoSend={onToggleAutoSend}
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
        onAddCurrentPageTextToAi={handleAddCurrentPageTextToAi}
      />
    </div>
  )
}

export default memo(PdfViewerDocument)

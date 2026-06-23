import type { PdfFile } from '@shared-core/types'

import { PDF_ZOOM_MAX_SCALE } from '@features/pdf/constants/pdfZoom'
import type { PdfTab, ReadingProgressUpdate } from '@features/pdf/hooks/types'

import type { AiDraftImageItem } from '@app/providers/ai/types'
import { useAppToolActions } from '@app/providers/AppToolContext'
import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'
import { useToastActions } from '@shared/stores/toastStore'

import { type DocumentLoadEvent, SpecialZoomLevel } from '@react-pdf-viewer/core'
import { Crop, Image as ImageIcon, RefreshCw, Type } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'

import {
  usePdfCaptureActions,
  usePdfContextMenu,
  usePdfCtrlWheelZoom,
  usePdfNavigation,
  usePdfPanTool,
  usePdfPlugins,
  usePdfResizeRefit,
  usePdfTextActions,
  usePdfViewerZoomIpc,
  usePdfWheelNavigation
} from '../hooks'
import ContextMenu, { type MenuItem } from './ContextMenu'
import PdfToolbar from './PdfToolbar'
import PdfViewerElement from './PdfViewerElement'
import { useContainerSize, useFitScale, useLastNavigationTime } from './usePdfViewerLayout'

type ScreenshotMeta = Pick<AiDraftImageItem, 'page' | 'captureKind'>

interface PdfViewerDocumentProps {
  pdfFile: PdfFile
  pdfUrl: string
  activePdfTab?: PdfTab | null
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
}

function PdfViewerDocument({
  pdfFile,
  pdfUrl,
  activePdfTab,
  onTextSelection,
  t,
  initialPage,
  onReadingProgressChange,
  isInteractionBlocked,
  autoSend,
  onToggleAutoSend,
  startScreenshot,
  queueImageForAi,
  isPanelResizing = false
}: PdfViewerDocumentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)
  const isTransitioningRef = useRef(false)
  const [scaleFactor, setScaleFactor] = useState(1)
  const [viewerReloadKey, setViewerReloadKey] = useState(0)
  const [isPanMode, setIsPanMode] = useState(false)
  const handleTogglePanMode = useCallback(() => setIsPanMode((v) => !v), [])
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(
    null
  )
  const appliedResumeSyncKeyRef = useRef<string | null>(null)
  const [, startTransition] = useTransition()

  const { queueTextForAi } = useAppToolActions()
  const { showSuccess, showWarning } = useToastActions()
  const { t: tt } = useTranslation()

  // --- Stabilize callback refs (declared before hooks produce values, so init with no-ops) ---
  const zoomToRef = useRef<(scale: number | SpecialZoomLevel) => void>(() => {})
  const handleFullPageScreenshotRef = useRef<() => Promise<void>>(async () => {})
  const extractCurrentPageTextRef = useRef<() => string | null>(() => null)

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

  // Keep refs current so effects always call the latest handler
  zoomToRef.current = zoomTo

  const {
    currentPage,
    totalPages,
    currentPageRef,
    handlePageChange,
    handleDocumentLoad,
    goToPreviousPage,
    goToNextPage,
    jumpToPage: jumpToPageFromNav
  } = usePdfNavigation({
    containerRef,
    jumpToPageRef,
    pdfPath: pdfFile?.path || null,
    initialPage,
    onReadingProgressChange
  })

  useEffect(() => {
    isMountedRef.current = true
    isTransitioningRef.current = false
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const lastNavigationTimeRef = useLastNavigationTime(currentPage)
  const isDocumentReady = totalPages > 0
  const containerSize = useContainerSize(containerRef, lastNavigationTimeRef, isPanelResizing)

  // Deduct padding to avoid triggering scrollbars due to react-pdf-viewer page margins/paddings
  const adjustedContainerSize = useMemo(
    () => ({
      w: Math.max(0, containerSize.w - 24),
      h: Math.max(0, containerSize.h - 24)
    }),
    [containerSize]
  )

  const fitScale = useFitScale(pageDimensions, adjustedContainerSize)

  usePdfResizeRefit(
    containerRef,
    zoomTo,
    isDocumentReady && !!pdfUrl,
    isPanelResizing,
    fitScale,
    lastNavigationTimeRef
  )
  usePdfViewerZoomIpc(zoomTo, scaleFactor, isDocumentReady && !!pdfUrl)
  usePdfCtrlWheelZoom(containerRef, zoomTo, scaleFactor, isDocumentReady && !!pdfUrl, isPanMode)
  // Fare tekerleği ile sayfa geçişi (Ctrl olmadan). Pan mode aktifken devre dışı.
  usePdfWheelNavigation(
    containerRef,
    goToNextPage,
    goToPreviousPage,
    isDocumentReady && !!pdfUrl && !isPanMode
  )

  // Fit-scale zoom
  useEffect(() => {
    if (!isDocumentReady || !pdfUrl || fitScale === null) return
    if (!isMountedRef.current) return
    zoomToRef.current(fitScale)
  }, [isDocumentReady, fitScale, pdfUrl])

  const { handleFullPageScreenshot, handleAreaScreenshot } = usePdfCaptureActions({
    currentPage,
    queueImageForAi,
    startScreenshot
  })

  const { isDragging: isPanDragging } = usePdfPanTool({ containerRef, isPanMode: isPanMode })

  const { extractCurrentPageText } = usePdfTextActions({
    containerRef,
    currentPage,
    onTextSelection,
    onTextExtracted: (text) => {
      queueTextForAi(text)
      showSuccess(tt('pdf_text_added_to_ai'))
    },
    onNoTextFound: () => {
      showWarning(tt('pdf_no_text_found'), undefined, undefined, 4000)
    },
    textSelectionEnabled:
      !isInteractionBlocked && activePdfTab?.kind !== 'drive' && !!pdfUrl && !isPanMode
  })

  const { contextMenu, setContextMenu } = usePdfContextMenu(containerRef)

  useEffect(() => {
    isTransitioningRef.current = true
    startTransition(() => {
      if (!isMountedRef.current) return
      setViewerReloadKey(0)
      setPageDimensions(null)
      isTransitioningRef.current = false
    })
  }, [pdfUrl, startTransition])

  const handleDocumentLoadWithDimensions = useCallback(
    async (e: DocumentLoadEvent) => {
      handleDocumentLoad(e)
      try {
        const page = await e.doc.getPage(1)
        if (!isMountedRef.current) return
        const viewport = page.getViewport({ scale: 1 })
        setPageDimensions({ width: viewport.width, height: viewport.height })
      } catch {
        // Dimensions unavailable
      }
    },
    [handleDocumentLoad]
  )

  useEffect(() => {
    if (!hasElectronApi()) return
    const api = getElectronApi()
    if (!api) return
    const removeListener = api.onTriggerScreenshot((type: string) => {
      if (type === APP_CONSTANTS.SCREENSHOT_TYPES.CROP) {
        startScreenshot({ page: currentPageRef.current, captureKind: 'selection' })
      } else if (type === APP_CONSTANTS.SCREENSHOT_TYPES.FULL) {
        void handleFullPageScreenshotRef.current()
      }
    })
    return () => {
      if (typeof removeListener === 'function') removeListener()
    }
  }, [startScreenshot])

  useEffect(() => {
    if (!isDocumentReady || !pdfUrl || !initialPage || initialPage < 2) return
    const syncKey = `${pdfUrl}:${viewerReloadKey}:${initialPage}`
    if (appliedResumeSyncKeyRef.current === syncKey) return
    appliedResumeSyncKeyRef.current = syncKey
    zoomToRef.current(fitScale ?? SpecialZoomLevel.PageWidth)
    jumpToPageFromNav(initialPage)
  }, [isDocumentReady, fitScale, initialPage, jumpToPageFromNav, pdfUrl, viewerReloadKey])

  handleFullPageScreenshotRef.current = handleFullPageScreenshot
  extractCurrentPageTextRef.current = extractCurrentPageText

  const handleAddCurrentPageTextToAi = useCallback(() => extractCurrentPageTextRef.current(), [])
  const handleSendPageAsImageToAi = useCallback(() => handleFullPageScreenshotRef.current(), [])

  const handleZoom = useCallback((e: { scale: number }) => {
    setScaleFactor(Math.min(e.scale, PDF_ZOOM_MAX_SCALE))
  }, [])

  const handleJumpToPage = useCallback(
    (page: number) => {
      jumpToPageFromNav(page)
    },
    [jumpToPageFromNav]
  )

  const handleCloseContextMenu = useCallback(() => setContextMenu(null), [setContextMenu])

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        label: tt('pdf_add_current_page_text_to_ai'),
        icon: Type,
        onClick: handleAddCurrentPageTextToAi
      },
      { label: tt('pdf_send_page_as_image'), icon: ImageIcon, onClick: handleSendPageAsImageToAi },
      { label: tt('ctx_crop_screenshot_ai'), icon: Crop, onClick: () => handleAreaScreenshot() },
      { separator: true, label: '', onClick: () => {} },
      {
        label: t('ctx_reload'),
        icon: RefreshCw,
        onClick: () => {
          isTransitioningRef.current = true
          startTransition(() => {
            setViewerReloadKey((c) => c + 1)
          })
        },
        shortcut: 'Ctrl+R',
        danger: true
      }
    ],
    [t, tt, handleAddCurrentPageTextToAi, handleSendPageAsImageToAi, handleAreaScreenshot]
  )

  const viewerElement = useMemo(
    () => (
      <PdfViewerElement
        pdfUrl={pdfUrl}
        viewerReloadKey={viewerReloadKey}
        plugins={plugins}
        onPageChange={handlePageChange}
        onDocumentLoad={handleDocumentLoadWithDimensions}
        onZoom={handleZoom}
        t={t}
        tt={tt}
      />
    ),
    [
      pdfUrl,
      viewerReloadKey,
      plugins,
      handlePageChange,
      handleDocumentLoadWithDimensions,
      handleZoom,
      t,
      tt
    ]
  )

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={containerRef}
        data-tour-id="tour-target-pdf-viewer"
        className={`pdf-viewer-container relative flex h-full min-h-0 flex-1 flex-col overflow-hidden scrollbar-gutter-stable${
          isPanMode ? 'pdf-pan-mode-active' : ''
        }${isPanDragging ? 'pdf-pan-mode-dragging' : ''}`}
      >
        {viewerElement}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={menuItems}
            onClose={handleCloseContextMenu}
          />
        )}
      </div>

      <PdfToolbar
        pdfFile={pdfFile}
        onStartScreenshot={handleAreaScreenshot}
        onFullPageScreenshot={handleFullPageScreenshot}
        autoSend={autoSend}
        onToggleAutoSend={onToggleAutoSend}
        panMode={isPanMode}
        onTogglePanMode={handleTogglePanMode}
        currentPage={currentPage}
        totalPages={totalPages}
        onPreviousPage={goToPreviousPage}
        onNextPage={goToNextPage}
        onJumpToPage={handleJumpToPage}
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

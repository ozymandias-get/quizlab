import { useOcrActions } from '@features/ocr/hooks/useOcrActions'
import { useOcrStore } from '@features/ocr/store/useOcrStore'
import OcrResultPanel from '@features/ocr/ui/OcrResultPanel'

import { memo, useCallback, useMemo } from 'react'

import { type PdfViewerDocumentProps, usePdfViewerState } from '../../hooks/usePdfViewerState'
import ContextMenu from './ContextMenu'
import PdfToolbar from './PdfToolbar'
import PdfViewerElement from './PdfViewerElement'

function PdfViewerDocument(props: PdfViewerDocumentProps) {
  const {
    containerRef,
    viewerReloadKey,
    isPanMode,
    isPanDragging,
    plugins,
    handlePageChange,
    handleDocumentLoadWithDimensions,
    handleZoom,
    tt,
    contextMenu,
    menuItems,
    handleCloseContextMenu,
    handleAreaScreenshot,
    handleFullPageScreenshot,
    handleTogglePanMode,
    currentPage,
    totalPages,
    goToPreviousPage,
    goToNextPage,
    handleJumpToPage,
    highlight,
    clearHighlights,
    PluginZoomIn,
    PluginZoomOut,
    CurrentScale,
    handleAddCurrentPageTextToAi
  } = usePdfViewerState(props)

  const { pdfFile, autoSend, onToggleAutoSend, pdfUrl } = props
  const ocrStatus = useOcrStore((s) => s.status)
  const ocrResult = useOcrStore((s) => s.result)
  const ocrError = useOcrStore((s) => s.error)
  const ocrIsOpen = useOcrStore((s) => s.isPanelOpen)
  const ocrCurrentPage = useOcrStore((s) => s.currentPage)
  const ocrClosePanel = useOcrStore((s) => s.closePanel)
  const { processPage, cancel } = useOcrActions()

  const handleOcrClose = useCallback(() => {
    if (
      ocrStatus === 'processing' ||
      ocrStatus === 'rendering-page' ||
      ocrStatus === 'initializing-engine'
    ) {
      cancel()
    }
    ocrClosePanel()
  }, [cancel, ocrClosePanel, ocrStatus])

  const handleOcrRetry = useCallback(() => {
    if (!pdfFile) return
    const page = ocrCurrentPage ?? currentPage
    void processPage({ pageNumber: page, pdfFile, pdfUrl })
  }, [pdfFile, pdfUrl, ocrCurrentPage, currentPage, processPage])

  const handleRunCurrentPageOcr = useCallback(() => {
    if (!pdfFile) return
    void processPage({ pageNumber: currentPage, pdfFile, pdfUrl })
  }, [currentPage, pdfFile, pdfUrl, processPage])

  const viewerElement = useMemo(
    () => (
      <PdfViewerElement
        pdfUrl={pdfUrl}
        viewerReloadKey={viewerReloadKey}
        plugins={plugins}
        onPageChange={handlePageChange}
        onDocumentLoad={handleDocumentLoadWithDimensions}
        onZoom={handleZoom}
        t={props.t}
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
      props.t,
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

        {/* OCR Result — draggable floating card, premium glassmorphism, non-blocking */}
        {ocrIsOpen && (
          <div className="pointer-events-none absolute inset-0 z-20">
            <div className="pointer-events-auto absolute right-3 bottom-3 flex max-h-[calc(100%-24px)] justify-end sm:right-4 sm:bottom-4">
              <OcrResultPanel
                result={ocrResult}
                status={ocrStatus}
                error={ocrError}
                pageNumber={ocrCurrentPage}
                viewerPage={currentPage}
                onClose={handleOcrClose}
                onRetry={handleOcrRetry}
                onRunCurrent={handleRunCurrentPageOcr}
              />
            </div>
          </div>
        )}
      </div>

      <PdfToolbar
        pdfFile={pdfFile}
        pdfUrl={pdfUrl}
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

import { useOcrActions } from '@features/ocr/hooks/useOcrActions'
import { createDocumentFingerprint } from '@features/ocr/lib/cacheKey'
import { getActivePdfDocumentFingerprint } from '@features/ocr/lib/renderPageToImage'
import { useOcrStore } from '@features/ocr/store/useOcrStore'
import OcrResultPanel from '@features/ocr/ui/OcrResultPanel'

import { useAppToolActions } from '@app/providers/AppToolContext'

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
  const { processPage, cancel, retry } = useOcrActions()
  const { queueTextForAi } = useAppToolActions()

  const viewerDocumentId = useMemo(() => {
    if (!pdfFile) return null
    const fp = getActivePdfDocumentFingerprint()
    return createDocumentFingerprint({
      path: pdfFile.path ?? null,
      name: pdfFile.name ?? null,
      size: pdfFile.size ?? null,
      streamUrl: pdfFile.streamUrl ?? null,
      pdfFingerprint: fp
    })
  }, [pdfFile])

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
    // Use typed retry that clears cache and re-runs with fresh render
    void retry({ pageNumber: page, pdfFile, pdfUrl })
  }, [pdfFile, pdfUrl, ocrCurrentPage, currentPage, retry])

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
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
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

      {/* OCR Result — floating draggable panel overlaying viewer, not clipped by overflow-hidden */}
      {ocrIsOpen && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
          <div className="pointer-events-auto absolute top-3 right-3 max-h-[calc(100%-24px)] max-w-[calc(100%-24px)] sm:top-4 sm:right-4">
            <OcrResultPanel
              result={ocrResult}
              status={ocrStatus}
              error={ocrError}
              pageNumber={ocrCurrentPage}
              viewerPage={currentPage}
              viewerDocumentId={viewerDocumentId}
              onClose={handleOcrClose}
              onRetry={handleOcrRetry}
              onRunCurrent={handleRunCurrentPageOcr}
              onSendToAi={queueTextForAi}
            />
          </div>
        </div>
      )}

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

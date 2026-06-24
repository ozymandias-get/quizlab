import { memo, useMemo } from 'react'

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

  const { pdfFile, autoSend, onToggleAutoSend } = props

  const viewerElement = useMemo(
    () => (
      <PdfViewerElement
        pdfUrl={props.pdfUrl}
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
      props.pdfUrl,
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

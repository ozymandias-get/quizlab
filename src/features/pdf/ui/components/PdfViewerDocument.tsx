import { memo } from 'react'

import type { PdfViewerDocumentProps } from '../../hooks/pdfViewerStateTypes'
import { usePdfViewerState } from '../../hooks/usePdfViewerState'
import ContextMenu from './ContextMenu'
import NativePdfViewer from './NativePdfViewer'
import PdfToolbar from './PdfToolbar'

/**
 * The PDF viewer shell: one container, one renderer, one toolbar.
 *
 * Pure JSX over `usePdfViewerState`, which owns the live page, the renderer and
 * the renderer-agnostic consumers (capture, pan, text actions, context menu).
 *
 * What survives from the era when this chose between `@react-pdf-viewer` and the
 * native viewer is the *seam*: the shared container, the toolbar and the context
 * menu were always renderer-agnostic and are still mounted exactly once. Only the
 * renderer branch collapsed, which is why there is no `import.meta.env` read here
 * and no second viewer to keep in step.
 */
function PdfViewerDocument(props: PdfViewerDocumentProps) {
  const {
    containerRef,
    canvasRef,
    textLayerRef,
    annotationLayerRef,
    searchLayerRef,
    nativeViewer,
    isPanMode,
    isPanDragging,
    tt,
    contextMenu,
    menuItems,
    handleCloseContextMenu,
    handleAreaScreenshot,
    handleFullPageScreenshot,
    handleTogglePanMode,
    handleAddCurrentPageTextToAi,
    handleReload
  } = usePdfViewerState(props)

  const { pdfFile, autoSend, onToggleAutoSend } = props

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={containerRef}
        className={`pdf-viewer-container relative flex h-full min-h-0 flex-1 flex-col overflow-hidden scrollbar-gutter-stable${
          isPanMode ? 'pdf-pan-mode-active' : ''
        }${isPanDragging ? 'pdf-pan-mode-dragging' : ''}`}
      >
        <NativePdfViewer
          controller={nativeViewer}
          canvasRef={canvasRef}
          textLayerRef={textLayerRef}
          annotationLayerRef={annotationLayerRef}
          searchLayerRef={searchLayerRef}
          t={props.t}
          tt={tt}
        />

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
        currentPage={nativeViewer.currentPage}
        totalPages={nativeViewer.totalPages}
        onPreviousPage={nativeViewer.goToPreviousPage}
        onNextPage={nativeViewer.goToNextPage}
        onJumpToPage={nativeViewer.jumpToPage}
        highlight={nativeViewer.highlight}
        clearHighlights={nativeViewer.clearHighlights}
        ZoomIn={nativeViewer.zoomControls.ZoomIn}
        ZoomOut={nativeViewer.zoomControls.ZoomOut}
        CurrentScale={nativeViewer.zoomControls.CurrentScale}
        onAddCurrentPageTextToAi={handleAddCurrentPageTextToAi}
        onReload={handleReload}
      />
    </div>
  )
}

export default memo(PdfViewerDocument)

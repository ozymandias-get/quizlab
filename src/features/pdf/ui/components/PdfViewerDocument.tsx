import { isNativePdfViewerEnabled } from '@features/pdf/native'
import { useNativePdfController } from '@features/pdf/native/useNativePdfController'

import { memo, useMemo, useRef } from 'react'

import { type PdfViewerDocumentProps, usePdfViewerState } from '../../hooks/usePdfViewerState'
import ContextMenu from './ContextMenu'
import NativePdfViewer from './NativePdfViewer'
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
    handleAddCurrentPageTextToAi,
    handleReload,
    adjustedContainerSize
  } = usePdfViewerState(props)

  const { pdfFile, autoSend, onToggleAutoSend, pdfUrl } = props

  // One read of the build-time flag, at the highest level that owns both
  // renderers. Everything below either takes the legacy branch or the native
  // branch; nothing re-reads the flag, so there is no way for the two paths to
  // disagree about which one is live.
  const isNativeViewer = isNativePdfViewerEnabled()

  // The native controller is always mounted so the hook order is stable, but it
  // is inert while the flag is off: no engine, no load, no wheel or resize
  // listeners. Its `canvasRef` and `textLayerRef` must live here, because the
  // canvas and the PDF.js text layer only exist while the native viewer is the
  // one rendering.
  const nativeCanvasRef = useRef<HTMLCanvasElement>(null)
  const nativeTextLayerRef = useRef<HTMLDivElement>(null)
  const nativeViewer = useNativePdfController({
    enabled: isNativeViewer,
    pdfUrl,
    reloadKey: viewerReloadKey,
    initialPage: props.initialPage,
    containerRef,
    adjustedContainerSize,
    isPanMode,
    isPanelResizing: props.isPanelResizing ?? false,
    pdfPath: pdfFile?.path ?? null,
    onReadingProgressChange: props.onReadingProgressChange,
    canvasRef: nativeCanvasRef,
    textLayerRef: nativeTextLayerRef
  })

  const legacyViewerElement = useMemo(
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

  // Toolbar wiring follows the same switch as the viewer. Page navigation, zoom
  // and the current-scale readout all read the native controller's own state, so
  // a toolbar button genuinely drives the native canvas rather than the inert
  // legacy plugin instances.
  const toolbarCurrentPage = isNativeViewer ? nativeViewer.currentPage : currentPage
  const toolbarTotalPages = isNativeViewer ? nativeViewer.totalPages : totalPages
  const toolbarPreviousPage = isNativeViewer ? nativeViewer.goToPreviousPage : goToPreviousPage
  const toolbarNextPage = isNativeViewer ? nativeViewer.goToNextPage : goToNextPage
  const toolbarJumpToPage = isNativeViewer ? nativeViewer.jumpToPage : handleJumpToPage
  const toolbarZoomIn = isNativeViewer ? nativeViewer.zoomControls.ZoomIn : PluginZoomIn
  const toolbarZoomOut = isNativeViewer ? nativeViewer.zoomControls.ZoomOut : PluginZoomOut
  const toolbarCurrentScale = isNativeViewer ? nativeViewer.zoomControls.CurrentScale : CurrentScale

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={containerRef}
        data-tour-id="tour-target-pdf-viewer"
        className={`pdf-viewer-container relative flex h-full min-h-0 flex-1 flex-col overflow-hidden scrollbar-gutter-stable${
          isPanMode ? 'pdf-pan-mode-active' : ''
        }${isPanDragging ? 'pdf-pan-mode-dragging' : ''}`}
      >
        {isNativeViewer ? (
          <NativePdfViewer
            controller={nativeViewer}
            canvasRef={nativeCanvasRef}
            textLayerRef={nativeTextLayerRef}
            t={props.t}
            tt={tt}
          />
        ) : (
          legacyViewerElement
        )}

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
        currentPage={toolbarCurrentPage}
        totalPages={toolbarTotalPages}
        onPreviousPage={toolbarPreviousPage}
        onNextPage={toolbarNextPage}
        onJumpToPage={toolbarJumpToPage}
        highlight={highlight}
        clearHighlights={clearHighlights}
        ZoomIn={toolbarZoomIn}
        ZoomOut={toolbarZoomOut}
        CurrentScale={toolbarCurrentScale}
        onAddCurrentPageTextToAi={handleAddCurrentPageTextToAi}
        onReload={handleReload}
        nativeCanvasMode={isNativeViewer}
      />
    </div>
  )
}

export default memo(PdfViewerDocument)

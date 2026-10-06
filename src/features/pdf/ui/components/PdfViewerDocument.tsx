import { isNativePdfViewerEnabled } from '@features/pdf/native'
import { useNativePdfController } from '@features/pdf/native/useNativePdfController'

import { memo, useMemo, useRef } from 'react'

import { type PdfViewerDocumentProps, usePdfViewerState } from '../../hooks/usePdfViewerState'
import ContextMenu from './ContextMenu'
import NativePdfViewer from './NativePdfViewer'
import PdfToolbar from './PdfToolbar'
import PdfViewerElement from './PdfViewerElement'

function PdfViewerDocument(props: PdfViewerDocumentProps) {
  // Capture reads the page through a ref rather than a value, and the ref has to
  // exist before `usePdfViewerState` runs — so it is created here, next to the
  // renderer switch that decides what it should say, and the answer is written
  // once the native controller is available below.
  //
  // On the legacy path the navigation hook's `currentPage` is authoritative and
  // this ref simply mirrors it; on the native path the legacy page state is inert
  // (`@react-pdf-viewer` is not mounted, so nothing reports page changes) and
  // without this a capture on page 40 would send page 1 to the AI.
  const capturePageRef = useRef(1)

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
  } = usePdfViewerState({ ...props, capturePageRef })

  const { pdfFile, autoSend, onToggleAutoSend, pdfUrl } = props

  // One read of the build-time flag, at the highest level that owns both
  // renderers. Everything below either takes the legacy branch or the native
  // branch; nothing re-reads the flag, so there is no way for the two paths to
  // disagree about which one is live.
  const isNativeViewer = isNativePdfViewerEnabled()

  // The native controller is always mounted so the hook order is stable, but it
  // is inert while the flag is off: no engine, no load, no wheel or resize
  // listeners. Its `canvasRef`, `textLayerRef`, `annotationLayerRef` and
  // `searchLayerRef` must live here, because the canvas, the two PDF.js layers and
  // the search overlay only exist while the native viewer is the one rendering.
  const nativeCanvasRef = useRef<HTMLCanvasElement>(null)
  const nativeTextLayerRef = useRef<HTMLDivElement>(null)
  const nativeAnnotationLayerRef = useRef<HTMLDivElement>(null)
  const nativeSearchLayerRef = useRef<HTMLDivElement>(null)
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
    textLayerRef: nativeTextLayerRef,
    annotationLayerRef: nativeAnnotationLayerRef,
    searchLayerRef: nativeSearchLayerRef
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
  // Capture follows the same switch, and for the same reason: the AI page image, the
  // crop screenshot and the context menu's two capture items must all name the page
  // the reader is actually looking at. Written every render rather than through an
  // effect, so a capture triggered in the same tick as a page change reads the new
  // page.
  capturePageRef.current = toolbarCurrentPage
  // Search follows the same switch, and needs no further wiring: both renderers expose
  // exactly the plugin's `highlight` / `clearHighlights`, so `PdfSearchBar` and the
  // shared store stay renderer-agnostic and no renderer check reaches the search UI.
  const toolbarHighlight = isNativeViewer ? nativeViewer.highlight : highlight
  const toolbarClearHighlights = isNativeViewer ? nativeViewer.clearHighlights : clearHighlights

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
            annotationLayerRef={nativeAnnotationLayerRef}
            searchLayerRef={nativeSearchLayerRef}
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
        highlight={toolbarHighlight}
        clearHighlights={toolbarClearHighlights}
        ZoomIn={toolbarZoomIn}
        ZoomOut={toolbarZoomOut}
        CurrentScale={toolbarCurrentScale}
        onAddCurrentPageTextToAi={handleAddCurrentPageTextToAi}
        onReload={handleReload}
      />
    </div>
  )
}

export default memo(PdfViewerDocument)

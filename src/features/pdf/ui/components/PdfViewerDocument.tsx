import { memo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import type { PdfViewerDocumentProps } from '../../hooks/pdfViewerStateTypes'
import { usePdfViewerState } from '../../hooks/usePdfViewerState'
import ContextMenu from './ContextMenu'
import NativePdfViewer from './NativePdfViewer'
import PdfDraftSlot from './PdfDraftSlot'
import PdfSelectionMenu from './PdfSelectionMenu'
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
    handleReload,
    selectionMenu
  } = usePdfViewerState(props)

  const { pdfFile, autoSend, onToggleAutoSend } = props
  const selectionMenuRef = useRef<HTMLDivElement | null>(null)

  // Menü dışına tıklanınca menü kapansın (taslak silinmez). Sağ tık menüsüyle
  // görsel/işlevsel engelleme olmasın: sağ tık menüsü açıksa seçim menüsü kapanır.
  useEffect(() => {
    if (!selectionMenu.menu) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      // Menünün kendi mousedown'u preventDefault yapar; burada yalnızca dış
      // tıklamalar kapatır.
      const menuEl = document.querySelector('[data-testid="pdf-selection-menu"]')
      if (menuEl && target && menuEl.contains(target)) return
      selectionMenu.closeMenu()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape yalnızca geçici seçim menüsünü kapatır.
      if (event.key === 'Escape') {
        selectionMenu.closeMenu()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectionMenu])

  // Sağ tık açıldığında seçim menüsünü kapat (birbirini engellemesin).
  useEffect(() => {
    if (contextMenu && selectionMenu.menu) {
      selectionMenu.closeMenu()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu])

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

        {/* AI Taslağı yuvası: panelin sağ alt köşesi, araç çubuğunun üstü. */}
        <PdfDraftSlot />

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={menuItems}
            onClose={handleCloseContextMenu}
          />
        )}
      </div>

      {selectionMenu.menu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div ref={selectionMenuRef}>
            <PdfSelectionMenu
              top={selectionMenu.menu.position.top}
              left={selectionMenu.menu.position.left}
              feedback={selectionMenu.feedback}
              addedCount={selectionMenu.addedCount}
              onSendToAi={selectionMenu.handleSendDirect}
              onAddToDraft={selectionMenu.handleAddToDraft}
            />
          </div>,
          document.body
        )}

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

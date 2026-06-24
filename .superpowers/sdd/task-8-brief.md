# Task 8: Extract usePdfViewerState hook from PdfViewerDocument.tsx

**Files:**

- Modify: `src/features/pdf/ui/components/PdfViewerDocument.tsx` (reduce from ~358 to ~150 lines)
- Create: `src/features/pdf/hooks/usePdfViewerState.ts`

## Steps

### Step 1: Read the current PdfViewerDocument.tsx

Read `src/features/pdf/ui/components/PdfViewerDocument.tsx` to understand the full structure.

### Step 2: Create usePdfViewerState.ts

Create `src/features/pdf/hooks/usePdfViewerState.ts` that accepts `PdfViewerDocumentProps` and returns all state, refs, and handlers.

Extract ALL of the following into the hook:

- All `useRef` declarations (containerRef, isMountedRef, isTransitioningRef, zoomToRef, handleFullPageScreenshotRef, extractCurrentPageTextRef, appliedResumeSyncKeyRef)
- All `useState` declarations (scaleFactor, viewerReloadKey, isPanMode, pageDimensions)
- All hook calls (usePdfPlugins, usePdfNavigation, usePdfCaptureActions, usePdfPanTool, usePdfTextActions, usePdfContextMenu, useLastNavigationTime, useContainerSize, useFitScale, usePdfResizeRefit, usePdfViewerZoomIpc, usePdfCtrlWheelZoom, usePdfWheelNavigation)
- All effects (mount/unmount effect, fit-scale zoom effect, viewer reload effect, screenshot IPC effect, resume page effect)
- All callbacks (handleTogglePanMode, handleDocumentLoadWithDimensions, handleAddCurrentPageTextToAi, handleSendPageAsImageToAi, handleZoom, handleJumpToPage, handleCloseContextMenu, menuItems useMemo, viewerElement useMemo, adjustedContainerSize useMemo)
- All stabilizer refs assignments (zoomToRef.current, handleFullPageScreenshotRef.current, extractCurrentPageTextRef.current)

The hook should return:

```typescript
interface UsePdfViewerStateReturn {
  containerRef: React.RefObject<HTMLDivElement | null>
  scaleFactor: number
  viewerReloadKey: number
  isPanMode: boolean
  isPanDragging: boolean
  pageDimensions: { width: number; height: number } | null
  currentPage: number
  totalPages: number
  containerSize: { w: number; h: number }
  fitScale: number | null
  plugins: ReturnType<typeof usePdfPlugins>['plugins']
  zoomTo: (scale: number | SpecialZoomLevel) => void
  CurrentScale: ReturnType<typeof usePdfPlugins>['CurrentScale']
  PluginZoomIn: ReturnType<typeof usePdfPlugins>['ZoomIn']
  PluginZoomOut: ReturnType<typeof usePdfPlugins>['ZoomOut']
  goToNextPage: () => void
  goToPreviousPage: () => void
  jumpToPageFromNav: (page: number) => void
  handleFullPageScreenshot: () => Promise<void>
  handleAreaScreenshot: () => void
  extractCurrentPageText: () => string | null
  contextMenu: ReturnType<typeof usePdfContextMenu>['contextMenu']
  handleDocumentLoadWithDimensions: (e: DocumentLoadEvent) => Promise<void>
  handleZoom: (e: { scale: number }) => void
  handleJumpToPage: (page: number) => void
  handleCloseContextMenu: () => void
  handleTogglePanMode: () => void
  menuItems: MenuItem[]
  handleAddCurrentPageTextToAi: () => void
  handleSendPageAsImageToAi: () => void
}
```

### Step 3: Update PdfViewerDocument.tsx

Replace all extracted code with `const { ... } = usePdfViewerState(props)` and keep only the JSX return with minimal logic.

Where props are:

```typescript
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
```

### Step 4: Verify

Run: `npx tsc --noEmit` and confirm no type errors.

### Step 5: Commit

```bash
git add src/features/pdf/ui/components/PdfViewerDocument.tsx src/features/pdf/hooks/usePdfViewerState.ts
git commit -m "refactor(PdfViewerDocument): extract state and hooks into usePdfViewerState hook"
```

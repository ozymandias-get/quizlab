import { useAppToolActions } from '@app/providers/AppToolContext'
import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'

import { useNativePdfController } from '../native/useNativePdfController'
import { useContainerSize, useLastNavigationTime } from '../ui/components/usePdfViewerLayout'
import {
  useCanvasGpuCleanup,
  usePdfCaptureActions,
  usePdfContextMenu,
  usePdfPanTool,
  usePdfTextActions
} from '../ui/hooks'
import type { PdfViewerDocumentProps, UsePdfViewerStateReturn } from './pdfViewerStateTypes'
import { usePdfViewerElectronScreenshot } from './usePdfViewerEffects'
import { usePdfViewerMenuItems } from './usePdfViewerMenuItems'

/** 20 px of container inset on each side, subtracted before the fit calculation. */
const CONTAINER_INSET_PX = 24

/**
 * The shared viewer state for one mounted PDF surface.
 *
 * ## What this owns
 *
 * The page and scale state belongs to `useNativePdfController`, which owns it
 * outright. The composition is therefore inverted: the controller is created
 * *here*, and the shared consumers — capture, pan, text actions, the context
 * menu, the Electron screenshot bridge — read its live page directly instead of a
 * value that lagged it by a render. `PdfViewerDocument` is pure JSX over what this
 * returns.
 *
 * ## What deliberately did not move
 *
 * The container ref, the reload key, pan mode, capture, `usePdfTextActions`,
 * `usePdfContextMenu` and the menu list are all renderer-agnostic and are mounted
 * exactly once, as before. The controller does the renderer-specific wiring
 * (canvas, the two PDF.js layers, the search overlay) because those elements only
 * exist while it is rendering.
 */
export function usePdfViewerState(props: PdfViewerDocumentProps): UsePdfViewerStateReturn {
  const {
    pdfFile,
    pdfUrl,
    activePdfTab,
    onTextSelection,
    t,
    onReadingProgressChange,
    isInteractionBlocked,
    startScreenshot,
    queueImageForAi,
    isPanelResizing = false
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const [viewerReloadKey, setViewerReloadKey] = useState(0)
  const [isPanMode, setIsPanMode] = useState(false)
  const handleTogglePanMode = useCallback(() => setIsPanMode((v) => !v), [])
  const [, startTransition] = useTransition()
  const { queueTextForAi } = useAppToolActions()
  const { showSuccess, showWarning } = useToastActions()
  const { t: tt } = useTranslation()
  const handleFullPageScreenshotRef = useRef<() => Promise<void>>(async () => {})
  const extractCurrentPageTextRef = useRef<() => string | null>(() => null)

  const lastNavigationTimeRef = useLastNavigationTime(0)
  const containerSize = useContainerSize(containerRef, lastNavigationTimeRef, isPanelResizing)
  // Exposed to the controller because it measures fit scale from the native page
  // size through the *same* `useFitScale`; re-deriving the inset here would be a
  // second copy of the same number.
  const adjustedContainerSize = useMemo(
    () => ({
      w: Math.max(0, containerSize.w - CONTAINER_INSET_PX),
      h: Math.max(0, containerSize.h - CONTAINER_INSET_PX)
    }),
    [containerSize]
  )

  // These have to exist above the controller: the canvas, the two PDF.js layers
  // and the search overlay only exist while the viewer is mounted.
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const annotationLayerRef = useRef<HTMLDivElement>(null)
  const searchLayerRef = useRef<HTMLDivElement>(null)

  const nativeViewer = useNativePdfController({
    enabled: true,
    pdfUrl,
    reloadKey: viewerReloadKey,
    initialPage: props.initialPage,
    containerRef,
    adjustedContainerSize,
    isPanMode,
    isPanelResizing,
    pdfPath: pdfFile?.path ?? null,
    onReadingProgressChange,
    canvasRef,
    textLayerRef,
    annotationLayerRef,
    searchLayerRef
  })

  // The live page, mirrored into a ref for the two consumers that must read it at
  // *call* time rather than at render: the crop screenshot's page metadata and the
  // capture ladder. Written during render so a capture triggered in the same tick
  // as a page change names the new page.
  const currentPage = nativeViewer.currentPage
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage
  props.capturePageRef && (props.capturePageRef.current = currentPage)

  // Single owner of PDF canvas/GPU lifetime. containerRef wraps every pdf.js
  // canvas, so this one MutationObserver sees all page swaps and zoom re-renders.
  useCanvasGpuCleanup(containerRef)

  const { handleFullPageScreenshot, handleAreaScreenshot } = usePdfCaptureActions({
    currentPage,
    capturePageRef: props.capturePageRef,
    queueImageForAi,
    startScreenshot,
    pdfUrl
  })

  const { isDragging: isPanDragging } = usePdfPanTool({ containerRef, isPanMode })

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

  usePdfViewerElectronScreenshot({
    startScreenshot,
    currentPageRef,
    handleFullPageScreenshotRef
  })

  handleFullPageScreenshotRef.current = handleFullPageScreenshot
  extractCurrentPageTextRef.current = extractCurrentPageText

  const { handleAddCurrentPageTextToAi, handleReload, handleCloseContextMenu, menuItems } =
    usePdfViewerMenuItems({
      t,
      tt,
      handleAreaScreenshot,
      extractCurrentPageTextRef,
      handleFullPageScreenshotRef,
      setContextMenu,
      setViewerReloadKey,
      startTransition
    })

  return {
    containerRef,
    canvasRef,
    textLayerRef,
    annotationLayerRef,
    searchLayerRef,
    nativeViewer,
    viewerReloadKey,
    isPanMode,
    isPanDragging,
    handleAreaScreenshot,
    handleFullPageScreenshot,
    contextMenu,
    handleCloseContextMenu,
    handleTogglePanMode,
    menuItems,
    handleAddCurrentPageTextToAi,
    handleReload,
    tt
  }
}

export type { PdfViewerDocumentProps, UsePdfViewerStateReturn }

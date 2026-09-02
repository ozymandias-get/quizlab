import { useOcrActions } from '@features/ocr/hooks/useOcrActions'
import { useOcrStore } from '@features/ocr/store/useOcrStore'

import { useAppToolActions } from '@app/providers/AppToolContext'
import { useToastActions } from '@shared/stores/toastStore'

import { type SpecialZoomLevel } from '@react-pdf-viewer/core'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useContainerSize,
  useFitScale,
  useLastNavigationTime
} from '../ui/components/usePdfViewerLayout'
import {
  useCanvasGpuCleanup,
  useCoalescedZoom,
  usePdfCaptureActions,
  usePdfContextMenu,
  usePdfNavigation,
  usePdfPanTool,
  usePdfPlugins,
  usePdfTextActions
} from '../ui/hooks'
import type { PdfViewerDocumentProps, UsePdfViewerStateReturn } from './pdfViewerStateTypes'
import {
  useDocumentLoadHandler,
  usePdfViewerElectronScreenshot,
  usePdfViewerInitialPageResume
} from './usePdfViewerEffects'
import { usePdfViewerMenuItems } from './usePdfViewerMenuItems'
import { usePdfViewerZoomOrchestrator } from './usePdfViewerZoomOrchestrator'

export function usePdfViewerState(props: PdfViewerDocumentProps): UsePdfViewerStateReturn {
  const {
    pdfFile,
    pdfUrl,
    activePdfTab,
    onTextSelection,
    t,
    initialPage,
    onReadingProgressChange,
    isInteractionBlocked,
    startScreenshot,
    queueImageForAi,
    isPanelResizing = false
  } = props
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
  const { processPage } = useOcrActions()
  const startAreaSelection = useOcrStore((s) => s.startAreaSelection)
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

  // All programmatic zoom sources funnel through one rAF-coalesced channel.
  const coalescedZoom = useCoalescedZoom(zoomTo)
  zoomToRef.current = coalescedZoom
  useCanvasGpuCleanup(containerRef)
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
  const isDocumentReadyWithUrl = isDocumentReady && !!pdfUrl
  const adjustedContainerSize = useMemo(
    () => ({
      w: Math.max(0, containerSize.w - 24),
      h: Math.max(0, containerSize.h - 24)
    }),
    [containerSize]
  )
  const fitScale = useFitScale(pageDimensions, adjustedContainerSize)

  usePdfViewerZoomOrchestrator({
    containerRef,
    coalescedZoom,
    isDocumentReadyWithUrl,
    isPanelResizing,
    fitScale,
    lastNavigationTimeRef,
    scaleFactor,
    isPanMode,
    goToNextPage,
    goToPreviousPage,
    isDocumentReady,
    pdfUrl,
    isMountedRef,
    zoomToRef
  })

  const { handleFullPageScreenshot, handleAreaScreenshot } = usePdfCaptureActions({
    currentPage,
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

  const handleOcrPage = useCallback(() => {
    if (!pdfFile) return
    setContextMenu(null)
    void processPage({ pageNumber: currentPage, pdfFile, pdfUrl })
  }, [pdfFile, pdfUrl, currentPage, processPage, setContextMenu])

  const handleOcrSelection = useCallback(() => {
    if (!pdfFile) {
      showWarning(tt('pdf_no_text_found'))
      return
    }
    setContextMenu(null)
    startAreaSelection(currentPage, pdfFile, pdfUrl)
  }, [pdfFile, pdfUrl, currentPage, startAreaSelection, setContextMenu, showWarning, tt])

  useEffect(() => {
    isTransitioningRef.current = true
    startTransition(() => {
      if (!isMountedRef.current) return
      setViewerReloadKey(0)
      setPageDimensions(null)
      isTransitioningRef.current = false
    })
  }, [pdfUrl, startTransition])

  const handleDocumentLoadWithDimensions = useDocumentLoadHandler({
    handleDocumentLoad,
    isMountedRef,
    setPageDimensions
  })

  usePdfViewerElectronScreenshot({ startScreenshot, currentPageRef, handleFullPageScreenshotRef })

  usePdfViewerInitialPageResume({
    isDocumentReady,
    pdfUrl,
    initialPage,
    viewerReloadKey,
    fitScale,
    jumpToPageFromNav,
    zoomToRef,
    appliedResumeSyncKeyRef
  })

  handleFullPageScreenshotRef.current = handleFullPageScreenshot
  extractCurrentPageTextRef.current = extractCurrentPageText

  const {
    handleAddCurrentPageTextToAi,
    handleSendPageAsImageToAi,
    handleZoom,
    handleJumpToPage,
    handleCloseContextMenu,
    menuItems
  } = usePdfViewerMenuItems({
    t,
    tt,
    handleAreaScreenshot,
    handleOcrPage,
    handleOcrSelection,
    extractCurrentPageTextRef,
    handleFullPageScreenshotRef,
    jumpToPageFromNav,
    setContextMenu,
    setScaleFactor,
    setViewerReloadKey,
    startTransition
  })

  return {
    containerRef,
    scaleFactor,
    viewerReloadKey,
    isPanMode,
    isPanDragging,
    pageDimensions,
    currentPage,
    totalPages,
    containerSize,
    fitScale,
    plugins,
    zoomTo,
    CurrentScale,
    PluginZoomIn,
    PluginZoomOut,
    goToNextPage,
    goToPreviousPage,
    jumpToPageFromNav,
    handleFullPageScreenshot,
    handleAreaScreenshot,
    extractCurrentPageText,
    contextMenu,
    handleDocumentLoadWithDimensions,
    handleZoom,
    handleJumpToPage,
    handleCloseContextMenu,
    handleTogglePanMode,
    menuItems,
    handleAddCurrentPageTextToAi,
    handleSendPageAsImageToAi,
    handlePageChange,
    highlight,
    clearHighlights,
    tt
  }
}

export type { PdfViewerDocumentProps, UsePdfViewerStateReturn }

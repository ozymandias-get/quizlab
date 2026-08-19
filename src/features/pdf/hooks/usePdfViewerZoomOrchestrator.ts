import { type SpecialZoomLevel } from '@react-pdf-viewer/core'
import { type MutableRefObject, type RefObject, useEffect } from 'react'

import {
  usePdfCtrlWheelZoom,
  usePdfResizeRefit,
  usePdfViewerZoomIpc,
  usePdfWheelNavigation
} from '../ui/hooks'

interface UsePdfViewerZoomOrchestratorProps {
  containerRef: RefObject<HTMLDivElement | null>
  coalescedZoom: (scale: number | SpecialZoomLevel) => void
  isDocumentReadyWithUrl: boolean
  isPanelResizing: boolean
  fitScale: number | null
  lastNavigationTimeRef: MutableRefObject<number>
  scaleFactor: number
  isPanMode: boolean
  goToNextPage: () => void
  goToPreviousPage: () => void
  isDocumentReady: boolean
  pdfUrl?: string
  isMountedRef: MutableRefObject<boolean>
  zoomToRef: MutableRefObject<(scale: number | SpecialZoomLevel) => void>
}

export function usePdfViewerZoomOrchestrator({
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
}: UsePdfViewerZoomOrchestratorProps) {
  usePdfResizeRefit(
    containerRef,
    coalescedZoom,
    isDocumentReadyWithUrl,
    isPanelResizing,
    fitScale,
    lastNavigationTimeRef
  )

  usePdfViewerZoomIpc(coalescedZoom, scaleFactor, isDocumentReadyWithUrl)

  usePdfCtrlWheelZoom(containerRef, coalescedZoom, scaleFactor, isDocumentReadyWithUrl, isPanMode)

  usePdfWheelNavigation(
    containerRef,
    goToNextPage,
    goToPreviousPage,
    isDocumentReadyWithUrl && !isPanMode
  )

  useEffect(() => {
    if (!isDocumentReady || !pdfUrl || fitScale === null) return
    if (!isMountedRef.current) return
    zoomToRef.current(fitScale)
  }, [isDocumentReady, fitScale, pdfUrl, isMountedRef, zoomToRef])
}

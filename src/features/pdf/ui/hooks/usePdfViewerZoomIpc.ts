import { useEffect, useRef } from 'react'
import { SpecialZoomLevel } from '@react-pdf-viewer/core'

import { PDF_ZOOM_MIN_SCALE, PDF_ZOOM_STEP } from '@features/pdf/constants/pdfZoom'

import type { PdfViewerZoomAction } from '@shared-core/types'
import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

type ZoomTo = (scale: number | SpecialZoomLevel) => void

/**
 * Native PDF context menu (Electron) zoom items → renderer PDF zoom (not webContents zoom).
 */
export function usePdfViewerZoomIpc(zoomTo: ZoomTo, scaleFactor: number, enabled: boolean) {
  const zoomToRef = useRef(zoomTo)
  const scaleRef = useRef(scaleFactor)
  zoomToRef.current = zoomTo
  scaleRef.current = scaleFactor

  useEffect(() => {
    if (!enabled || !hasElectronApi()) {
      return
    }

    const remove = getElectronApi().onPdfViewerZoom((action: PdfViewerZoomAction) => {
      if (action === 'reset') {
        zoomToRef.current(SpecialZoomLevel.PageFit)
        return
      }
      if (action === 'in') {
        zoomToRef.current(scaleRef.current + PDF_ZOOM_STEP)
        return
      }
      if (action === 'out') {
        zoomToRef.current(Math.max(PDF_ZOOM_MIN_SCALE, scaleRef.current - PDF_ZOOM_STEP))
      }
    })

    return remove
  }, [enabled])
}

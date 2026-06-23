/**
 * Native PDF context menu (Electron) zoom items → renderer PDF zoom (not webContents zoom).
 */
import type { PdfViewerZoomAction } from '@shared-core/types'

import { PDF_ZOOM_MIN_SCALE, PDF_ZOOM_STEP } from '@features/pdf/constants/pdfZoom'

import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import { SpecialZoomLevel } from '@react-pdf-viewer/core'
import { useEffect, useRef } from 'react'

type ZoomTo = (scale: number | SpecialZoomLevel) => void

export function usePdfViewerZoomIpc(zoomTo: ZoomTo, scaleFactor: number, enabled: boolean) {
  const zoomToRef = useRef(zoomTo)
  const scaleRef = useRef(scaleFactor)
  const enabledRef = useRef(enabled)
  zoomToRef.current = zoomTo
  scaleRef.current = scaleFactor
  enabledRef.current = enabled

  useEffect(() => {
    if (!hasElectronApi()) {
      return
    }

    const api = getElectronApi()
    if (!api) return
    const remove = api.onPdfViewerZoom((action: PdfViewerZoomAction) => {
      if (!enabledRef.current) return
      if (action === 'reset') {
        zoomToRef.current(SpecialZoomLevel.PageWidth)
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
  }, [])
}

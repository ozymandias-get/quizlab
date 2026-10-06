/**
 * Native PDF context menu (Electron) zoom items → renderer PDF zoom (not webContents zoom).
 *
 * ## Why the scale domain is numeric
 *
 * This hook used to reset to `@react-pdf-viewer`'s `SpecialZoomLevel.PageWidth`
 * keyword. That keyword is a viewer API, not a scale: only RPV's own `zoomTo`
 * could interpret it. With the native viewer as the sole renderer there is no
 * `SpecialZoomLevel` left to pass, so reset takes the **numeric** fit scale the
 * product already computes everywhere else — the same `useFitScale` number that
 * `usePdfResizeRefit` refits to and that `useNativePdfScaleState#fit` applies.
 * One fit number, one meaning, whichever renderer is live.
 *
 * Making the contract numeric is also what keeps this hook renderer-agnostic: it
 * imports no viewer package, so the same three actions reach the legacy coalesced
 * channel and the native rAF-coalesced one without either side learning about
 * the other.
 *
 * ## Subscription shape
 *
 * One `useEffect` with no dependencies, so a mounted viewer holds exactly one
 * `onPdfViewerZoom` subscription regardless of how often its scale or fit scale
 * changes — the same shape as `usePdfCtrlWheelZoom` and `usePdfWheelNavigation`.
 * The `enabled` gate lives inside the handler so an inert viewer still subscribes
 * and still unsubscribes cleanly, which is what makes "exactly one active viewer
 * responds" a structural property rather than a timing one.
 */
import type { PdfViewerZoomAction } from '@shared-core/types'

import { PDF_ZOOM_MIN_SCALE, PDF_ZOOM_STEP } from '@features/pdf/constants/pdfZoom'

import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import { useEffect, useRef } from 'react'

type ZoomTo = (scale: number) => void

export function usePdfViewerZoomIpc(
  zoomTo: ZoomTo,
  scale: number,
  /** Numeric fit scale, or `null` while the page size is still unknown. */
  fitScale: number | null,
  enabled: boolean
) {
  const zoomToRef = useRef(zoomTo)
  const scaleRef = useRef(scale)
  const fitScaleRef = useRef(fitScale)
  const enabledRef = useRef(enabled)
  zoomToRef.current = zoomTo
  scaleRef.current = scale
  fitScaleRef.current = fitScale
  enabledRef.current = enabled

  useEffect(() => {
    if (!hasElectronApi()) {
      return
    }

    const api = getElectronApi()
    // The browser/dev fallback ships this as a no-op, and the packaged preload
    // always provides it. Anything else — a partial API object, a test double, an
    // older preload paired with a newer renderer — must degrade to "no context-menu
    // zoom" rather than throw inside a passive effect, which would take the whole
    // PDF viewer down over a convenience menu item.
    if (!api || typeof api.onPdfViewerZoom !== 'function') return
    const remove = api.onPdfViewerZoom((action: PdfViewerZoomAction) => {
      if (!enabledRef.current) return
      if (action === 'reset') {
        const fit = fitScaleRef.current
        if (fit === null) return
        zoomToRef.current(fit)
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

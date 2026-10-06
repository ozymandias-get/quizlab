/**
 * Native scale state: one numeric `scale`, clamped, with an explicit fit.
 *
 * ## Why the native path owns its own scale
 *
 * The legacy viewer's scale lives inside `@react-pdf-viewer` and is reached
 * through `zoomTo`, which accepts `SpecialZoomLevel` strings as well as numbers.
 * The native viewer has no viewer to ask, so it holds the number itself.
 *
 * ## `PageWidth` becomes a real number here
 *
 * The legacy viewer starts at `SpecialZoomLevel.PageWidth`. There is no such
 * thing as a numeric scale that means "fit the page" to PDF.js — the fit is a
 * computation from the page size and the container size. So the native path
 * computes that number (`fitScale`, from the shared `useFitScale`) and applies it
 * as an ordinary scale. `SpecialZoomLevel` never crosses into the native engine
 * or its hooks.
 *
 * ## The initial fit runs once per document identity
 *
 * Fit is keyed on `(pdfUrl, reloadKey)` in a ref rather than being a plain effect
 * dependency. That is what prevents the loop
 * `fit → render → resize → new fitScale → fit → …`: the container size is an input
 * to `fitScale`, and applying fit changes the canvas size, which the container
 * observer reports. Re-applying on every `fitScale` value would make the viewer
 * chase its own tail; a completed fit is therefore never re-applied for the same
 * document. Container resizes are a separate lifecycle
 * (`usePdfResizeRefit`), which is the path that is *meant* to refit.
 *
 * Every zoom source goes through the rAF-coalesced channel, so a burst of zoom
 * requests commits at most one effective change per frame.
 */
import { PDF_ZOOM_STEP } from '@features/pdf/constants/pdfZoom'
import { clampPdfScale } from '@features/pdf/native/nativePdfBounds'
import {
  type NumericZoomTo,
  useNativeCoalescedScale
} from '@features/pdf/native/useNativeCoalescedScale'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseNativePdfScaleStateOptions {
  enabled: boolean
  pdfUrl: string
  reloadKey: number
  /** Shared `useFitScale` output, or `null` while the page size is unknown. */
  fitScale: number | null
}

export interface NativePdfScaleHandle {
  /** Effective numeric scale, always within the product's zoom range. */
  scale: number
  /** rAF-coalesced numeric zoom channel — every zoom source goes through it. */
  zoomTo: NumericZoomTo
  zoomIn: () => void
  zoomOut: () => void
  /** Return to the current fit scale. No-op while the fit scale is unknown. */
  fit: () => void
}

export function useNativePdfScaleState({
  enabled,
  pdfUrl,
  reloadKey,
  fitScale
}: UseNativePdfScaleStateOptions): NativePdfScaleHandle {
  // `1` is only ever visible before the first fit lands, which is behind the
  // loading state, so it is a placeholder rather than a user-visible default.
  const [scale, setScale] = useState(1)

  const scaleRef = useRef(scale)
  scaleRef.current = scale

  const fitScaleRef = useRef(fitScale)
  fitScaleRef.current = fitScale

  const applyScale = useCallback((next: number) => {
    setScale(clampPdfScale(next))
  }, [])

  const zoomTo = useNativeCoalescedScale(applyScale)

  const identity = `${pdfUrl}:${reloadKey}`
  const appliedFitIdentityRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (fitScale === null) return
    if (appliedFitIdentityRef.current === identity) return
    appliedFitIdentityRef.current = identity
    zoomTo(fitScale)
  }, [enabled, identity, fitScale, zoomTo])

  const zoomIn = useCallback(() => {
    zoomTo(clampPdfScale(scaleRef.current + PDF_ZOOM_STEP))
  }, [zoomTo])

  const zoomOut = useCallback(() => {
    zoomTo(clampPdfScale(scaleRef.current - PDF_ZOOM_STEP))
  }, [zoomTo])

  const fit = useCallback(() => {
    if (fitScaleRef.current === null) return
    zoomTo(fitScaleRef.current)
  }, [zoomTo])

  return { scale, zoomTo, zoomIn, zoomOut, fit }
}

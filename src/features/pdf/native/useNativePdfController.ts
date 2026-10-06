/**
 * The native viewer's controller: document + page + scale + render, and the
 * toolbar contract the legacy toolbar binds to.
 *
 * ## What this owns
 *
 * | Concern      | Owner                                                                          |
 * | ------------ | ------------------------------------------------------------------------------ |
 * | instances    | `useNativePdfEngine` — one manager + one renderer per mount                      |
 * | document     | `useNativePdfDocument` — `(pdfUrl, reloadKey)` → ready document                   |
 * | page         | `useNativePdfPageState` — 1-based, clamped                                      |
 * | scale        | `useNativePdfScaleState` — numeric, clamped, fit on identity                     |
 * | render       | `useNativePdfRender` — one page, one canvas, supersede-cancel                    |
 * | text layer   | `useNativePdfTextLayer` — one page, one PDF.js `TextLayer`                       |
 * | annotations  | `useNativePdfAnnotationLayer` — one page, one PDF.js `AnnotationLayer` + links   |
 *
 * The order of these calls matters exactly once, and it is load-bearing: the
 * engine-creating effect in `useNativePdfEngine` is declared before the
 * document-loading effect in `useNativePdfDocument`, so the engine exists by the
 * time the document hook runs its body. The text-layer and annotation-layer effects
 * are declared after both render effects so that, within a single commit, the canvas
 * and the two layers are torn down and rebuilt in the order they are painted.
 *
 * ## What is reused from the legacy path, unchanged
 *
 * `useFitScale`, `useLastNavigationTime`, `usePdfCtrlWheelZoom`,
 * `usePdfWheelNavigation`, `usePdfResizeRefit` and `usePdfTextActions` are the
 * same functions the legacy viewer uses. Reuse rather than re-implementation is
 * deliberate: the zoom clamps, the 40 ms Ctrl+wheel throttle, the 150 ms resize
 * debounce, the 1 %-granularity fit quantization and the whole selection
 * lifecycle — capture-phase listeners, the 150 ms scroll freeze, rAF coalescing,
 * `pdf-selection-active`, `requestIdleCallback` with its 500 ms fallback — are
 * Phase 2-pinned behaviour, and a second copy of any of them would be free to
 * drift away from the tests that guard it. Two of the shared hooks needed one
 * type-level change to be reachable from a numeric-only caller
 * (`usePdfCtrlWheelZoom`), plus one additive optional argument
 * (`usePdfResizeRefit`'s numeric fallback); no behaviour changed.
 *
 * `usePdfTextActions` needs nothing native at all: it talks to the shared viewer
 * container and to the extractors, and both now resolve whichever text layer is
 * mounted. That is why there is no second selection system here.
 *
 * ## What is deliberately not here
 *
 * `usePdfViewerZoomIpc` (Electron context-menu zoom) is not wired: it hard-codes
 * `SpecialZoomLevel.PageWidth` as its reset target and belongs with the
 * native-viewer work that replaces the legacy context menu. `usePdfContextMenu`
 * and the capture actions reach into the legacy viewer's DOM and its
 * `activePdfDocumentRegistry`, so they stay on the legacy path.
 */
import type { ReadingProgressUpdate } from '@features/pdf/hooks/types'
import { clampPdfPage } from '@features/pdf/native/nativePdfBounds'
import { useNativePdfAnnotationLayer } from '@features/pdf/native/useNativePdfAnnotationLayer'
import {
  type NativePdfDocumentStatus,
  useNativePdfDocument
} from '@features/pdf/native/useNativePdfDocument'
import {
  type NativePdfEngineHandle,
  useNativePdfEngine
} from '@features/pdf/native/useNativePdfEngine'
import { useNativePdfPageState } from '@features/pdf/native/useNativePdfPageState'
import { useNativePdfRender } from '@features/pdf/native/useNativePdfRender'
import { useNativePdfScaleState } from '@features/pdf/native/useNativePdfScaleState'
import { useNativePdfTextLayer } from '@features/pdf/native/useNativePdfTextLayer'
import {
  type CurrentScaleComponent,
  type ZoomComponent
} from '@features/pdf/ui/components/PdfZoomControls'
import { useFitScale, useLastNavigationTime } from '@features/pdf/ui/components/usePdfViewerLayout'
import {
  usePdfCtrlWheelZoom,
  usePdfResizeRefit,
  usePdfWheelNavigation
} from '@features/pdf/ui/hooks'

import { type RefObject, useCallback, useMemo } from 'react'

import { useNativeZoomControls } from './nativeZoomControls'

/**
 * Fallback scale for `usePdfResizeRefit` when no fit scale is known yet.
 *
 * Numeric by construction: the native path has no `SpecialZoomLevel`, and this
 * only becomes visible if the container resizes before the first page has been
 * measured — behind the loading state in practice.
 */
const NATIVE_FIT_FALLBACK_SCALE = 1

interface UseNativePdfControllerOptions {
  /** The feature flag. `false` keeps every native hook inert and idle. */
  enabled: boolean
  pdfUrl: string
  /** Reload signal from the shared viewer state; the same URL, new lifecycle. */
  reloadKey: number
  initialPage?: number
  /** The shared viewer container — also the wheel / resize event surface. */
  containerRef: RefObject<HTMLElement | null>
  /** Shared container size minus the viewer inset, from `usePdfViewerState`. */
  adjustedContainerSize: { w: number; h: number }
  isPanMode: boolean
  isPanelResizing: boolean
  /** Only used as the reading-progress key. */
  pdfPath: string | null
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
  /** Created by the component; the render effect writes into it. */
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** Created by the component; the text-layer effect mounts PDF.js into it. */
  textLayerRef: RefObject<HTMLElement | null>
  /** Created by the component; the annotation-layer effect mounts PDF.js into it. */
  annotationLayerRef: RefObject<HTMLElement | null>
}

export interface NativePdfController {
  status: NativePdfDocumentStatus
  totalPages: number
  /** 1-based page currently shown. */
  currentPage: number
  /** Effective numeric scale, within the product's zoom range. */
  scale: number
  loadError: string | null
  renderError: string | null
  /** A genuine text-layer failure. `null` while rendering and on teardown. */
  textLayerError: string | null
  /** A genuine annotation-layer failure. `null` while rendering and on teardown. */
  annotationLayerError: string | null
  goToPreviousPage: () => void
  goToNextPage: () => void
  jumpToPage: (page: number) => void
  zoomTo: (scale: number) => void
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
  /** Render-prop components shaped like the legacy toolbar's zoom controls. */
  zoomControls: {
    ZoomIn: ZoomComponent
    ZoomOut: ZoomComponent
    CurrentScale: CurrentScaleComponent
  }
}

export function useNativePdfController({
  enabled,
  pdfUrl,
  reloadKey,
  initialPage,
  containerRef,
  adjustedContainerSize,
  isPanMode,
  isPanelResizing,
  pdfPath,
  onReadingProgressChange,
  canvasRef,
  textLayerRef,
  annotationLayerRef
}: UseNativePdfControllerOptions): NativePdfController {
  const engine: NativePdfEngineHandle = useNativePdfEngine(enabled)

  const { status, totalPages, pageDimensions, loadError } = useNativePdfDocument({
    enabled,
    engine,
    pdfUrl,
    reloadKey
  })

  const isReady = enabled && status === 'ready'

  const { currentPage, goToPreviousPage, goToNextPage, jumpToPage } = useNativePdfPageState({
    enabled,
    pdfUrl,
    reloadKey,
    totalPages,
    initialPage,
    pdfPath,
    onReadingProgressChange
  })

  // The shared fit calculation, fed the native path's own page size. The viewer
  // starts at `SpecialZoomLevel.PageWidth`; here that keyword is replaced by the
  // number it stands for.
  const fitScale = useFitScale(pageDimensions, adjustedContainerSize)

  const { scale, zoomTo, zoomIn, zoomOut, fit } = useNativePdfScaleState({
    enabled,
    pdfUrl,
    reloadKey,
    fitScale
  })

  const lastNavigationTimeRef = useLastNavigationTime(currentPage)

  usePdfCtrlWheelZoom(containerRef, zoomTo, scale, isReady, isPanMode)
  usePdfWheelNavigation(containerRef, goToNextPage, goToPreviousPage, isReady && !isPanMode)

  // `usePdfResizeRefit` is shared with the legacy viewer, whose scale domain
  // includes `@react-pdf-viewer`'s `SpecialZoomLevel` keywords — which the native
  // path neither has nor wants. Taking the parameter as `unknown` rather than
  // importing that type keeps the native boundary free of `@react-pdf-viewer`
  // while still running the shared debounce / cooldown / navigation-lock rules
  // verbatim. A number is always passed (`fitScale`, or the numeric fallback
  // below), so the guard is defensive rather than lossy.
  const refitZoomTo = useCallback(
    (value: unknown) => {
      if (typeof value === 'number') zoomTo(value)
    },
    [zoomTo]
  )
  usePdfResizeRefit(
    containerRef,
    refitZoomTo,
    isReady,
    isPanelResizing,
    fitScale,
    lastNavigationTimeRef,
    NATIVE_FIT_FALLBACK_SCALE
  )

  const { renderError } = useNativePdfRender({
    enabled,
    engine,
    status,
    canvasRef,
    currentPage,
    scale
  })

  // The same viewport identity the canvas and the document hooks use: a reload of
  // the same file is a different document, and the text-content cache that hangs
  // off it has to agree.
  const documentKey = `${pdfUrl}::${reloadKey}`

  const { textLayerError } = useNativePdfTextLayer({
    enabled,
    engine,
    status,
    textLayerRef,
    documentKey,
    currentPage,
    scale
  })

  // Declared after the text layer so the DOM is torn down and rebuilt in the order it
  // is painted: canvas, text layer, annotation layer. An internal destination resolves
  // through `jumpToPage`, so a link is the same navigation the toolbar performs.
  const { annotationLayerError } = useNativePdfAnnotationLayer({
    enabled,
    engine,
    status,
    annotationLayerRef,
    documentKey,
    currentPage,
    scale,
    jumpToPage
  })

  const zoomControls = useNativeZoomControls({ scale, zoomIn, zoomOut })

  return useMemo(
    () => ({
      status,
      totalPages,
      currentPage: clampPdfPage(currentPage, totalPages),
      scale,
      loadError,
      renderError,
      textLayerError,
      annotationLayerError,
      goToPreviousPage,
      goToNextPage,
      jumpToPage,
      zoomTo,
      zoomIn,
      zoomOut,
      fit,
      zoomControls
    }),
    [
      status,
      totalPages,
      currentPage,
      scale,
      loadError,
      renderError,
      textLayerError,
      annotationLayerError,
      goToPreviousPage,
      goToNextPage,
      jumpToPage,
      zoomTo,
      zoomIn,
      zoomOut,
      fit,
      zoomControls
    ]
  )
}

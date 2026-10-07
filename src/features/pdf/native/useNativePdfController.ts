/**
 * The native viewer's controller: document + page + scale + render, and the
 * toolbar contract the shared toolbar binds to.
 *
 * ## What this owns
 *
 * | Concern      | Owner                                                                          |
 * | ------------ | ------------------------------------------------------------------------------ |
 * | instances    | `useNativePdfEngine` — one manager + one renderer per mount                      |
 * | document     | `useNativePdfDocument` — `(pdfUrl, reloadKey)` → ready document                   |
 * | page         | `useNativePdfPageState` — 1-based, clamped                                      |
 * | transition   | `useNativePdfPageTransition` — presentation only, no second page state               |
 * | scale        | `useNativePdfScaleState` — numeric, clamped, fit on identity                     |
 * | render       | `useNativePdfRender` — one page, one canvas, supersede-cancel                    |
 * | text layer   | `useNativePdfTextLayer` — one page, one PDF.js `TextLayer`                       |
 * | annotations  | `useNativePdfAnnotationLayer` — one page, one PDF.js `AnnotationLayer` + links   |
 * | search       | `useNativePdfSearch` — keyword → match rectangles in the highlight overlay      |
 * | capture      | `useNativePdfCaptureDocument` — publishes the document to the capture pipeline  |
 *
 * The order of these calls matters three times, and all three are load-bearing:
 * the engine-creating effect in `useNativePdfEngine` is declared before the
 * document-loading effect in `useNativePdfDocument`, so the engine exists by the
 * time the document hook runs its body; the capture-registration effect follows
 * the document hook, so it only ever publishes a document that exists; and the
 * text-layer, annotation-layer and search effects are declared after both render
 * effects so that, within a single commit, the canvas and the three overlays are
 * torn down and rebuilt in the order they are painted — and, for search, so the
 * text layer's synchronous cleanup empties the runs the search is about to
 * measure.
 *
 * ## Where the page transition sits in that order
 *
 * `useNativePdfPageTransition` is declared between the page state and the render,
 * and that is a fourth load-bearing ordering rather than a stylistic one: within a
 * commit, its effect has to see the page change *before* the render effect starts,
 * because the transition is only *presented* when that render reports its commit. In
 * the other order the direction would always be one page behind.
 *
 * It adds no page state and gates nothing. `currentPage` from `useNativePdfPageState`
 * is still the only page the viewer has, and no render, layer or navigation waits on
 * it.
 *
 * ## What is shared with the rest of the feature, unchanged
 *
 * `useFitScale`, `useLastNavigationTime`, `usePdfCtrlWheelZoom`,
 * `usePdfWheelNavigation`, `usePdfResizeRefit` and `usePdfTextActions` are the
 * same functions the viewport and selection layers outside `native/` use.
 * Reuse rather than re-implementation is deliberate: the zoom clamps, the 40 ms
 * Ctrl+wheel throttle, the 150 ms resize debounce, the 1 %-granularity fit
 * quantization and the whole selection lifecycle — capture-phase listeners, the
 * 150 ms scroll freeze, rAF coalescing, `pdf-selection-active`,
 * `requestIdleCallback` with its 500 ms fallback — are all pinned by their own
 * tests, and a second copy of any of them would be free to drift away from the
 * tests that guard it. Two of the shared hooks needed one type-level change to be
 * reachable from a numeric-only caller (`usePdfCtrlWheelZoom`), plus one additive
 * optional argument (`usePdfResizeRefit`'s numeric fallback); no behaviour changed.
 *
 * `usePdfTextActions` needs nothing native at all: it talks to the shared viewer
 * container and to the extractors, and both now resolve whichever text layer is
 * mounted. That is why there is no second selection system here.
 *
 * ## What is deliberately not here
 *
 * `usePdfContextMenu` itself is renderer-agnostic — it listens on the shared
 * container and renders one `ContextMenu` — and its capture items
 * reach the real backend now that the document is published to the registry, so
 * neither the hook nor the menu needed a native branch.
 *
 * `PdfSearchBar` and `usePdfSearchStore` are not native code and do not appear here:
 * the search bar is one component, and it only ever calls `highlight` /
 * `clearHighlights`, which this controller implements.
 */
import type { ReadingProgressUpdate } from '@features/pdf/hooks/types'
import { clampPdfPage } from '@features/pdf/native/nativePdfBounds'
import { useNativePdfAnnotationLayer } from '@features/pdf/native/useNativePdfAnnotationLayer'
import { useNativePdfCaptureDocument } from '@features/pdf/native/useNativePdfCaptureDocument'
import {
  type NativePdfDocumentStatus,
  useNativePdfDocument
} from '@features/pdf/native/useNativePdfDocument'
import {
  type NativePdfEngineHandle,
  useNativePdfEngine
} from '@features/pdf/native/useNativePdfEngine'
import { useNativePdfPageState } from '@features/pdf/native/useNativePdfPageState'
import { useNativePdfPageTransition } from '@features/pdf/native/useNativePdfPageTransition'
import { useNativePdfRender } from '@features/pdf/native/useNativePdfRender'
import { useNativePdfScaleState } from '@features/pdf/native/useNativePdfScaleState'
import {
  type NativePdfSearchHandle,
  useNativePdfSearch
} from '@features/pdf/native/useNativePdfSearch'
import { useNativePdfTextLayer } from '@features/pdf/native/useNativePdfTextLayer'
import {
  type CurrentScaleComponent,
  type ZoomComponent
} from '@features/pdf/ui/components/PdfZoomControls'
import { useFitScale, useLastNavigationTime } from '@features/pdf/ui/components/usePdfViewerLayout'
import {
  usePdfCtrlWheelZoom,
  usePdfResizeRefit,
  usePdfViewerZoomIpc,
  usePdfWheelNavigation
} from '@features/pdf/ui/hooks'
import { usePdfZoomShortcuts } from '@features/pdf/viewport/usePdfZoomShortcuts'

import { type RefObject, useCallback, useMemo } from 'react'

import { useNativeZoomControls } from './nativeZoomControls'

/**
 * Fallback scale for `usePdfResizeRefit` when no fit scale is known yet.
 *
 * Numeric by construction: the scale domain is numeric, so there is no fit-by-keyword
 * to ask for. This only becomes visible if the container resizes before the first page
 * has been measured — behind the loading state in practice.
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
  /** Created by the component; the search effect measures and fills it. */
  searchLayerRef: RefObject<HTMLElement | null>
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
  /**
   * Highlight every match of `keyword` on the rendered page.
   *
   * The two calls `PdfToolbar` binds for search, so its search UI needs no branch.
   */
  highlight: NativePdfSearchHandle['highlight']
  /** Drop the search query and empty the overlay. */
  clearHighlights: NativePdfSearchHandle['clearHighlights']
  /**
   * A genuine search failure. `null` while searching and on teardown.
   *
   * Deliberately not rendered: a search that cannot measure costs the reader their
   * results, not their page.
   */
  searchError: string | null
  goToPreviousPage: () => void
  goToNextPage: () => void
  jumpToPage: (page: number) => void
  zoomTo: (scale: number) => void
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
  /** Render-prop components shaped like the toolbar's zoom controls. */
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
  annotationLayerRef,
  searchLayerRef
}: UseNativePdfControllerOptions): NativePdfController {
  const engine: NativePdfEngineHandle = useNativePdfEngine(enabled)

  const { status, totalPages, pageDimensions, loadError } = useNativePdfDocument({
    enabled,
    engine,
    pdfUrl,
    reloadKey
  })

  // Declared right after the document hook because it publishes that document:
  // capture borrows the mounted document through the registry instead of
  // re-decoding the file, so one registration is all the door capture needs.
  // Withdrawing is token-scoped, so of two mounted viewers (LeftPanel +
  // FocusOverlay) only the one unmounting clears the slot.
  useNativePdfCaptureDocument({ enabled, engine, status, pdfUrl, reloadKey })

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

  // The same viewport identity the canvas and the document hooks use: a reload of the
  // same file is a different document, and the text-content cache that hangs off it has
  // to agree. Declared here rather than beside the render because the page transition
  // reads it too, and it needs it *before* the render hook — the transition's effect has
  // to have seen the page change before the render that will report its commit.
  const documentKey = `${pdfUrl}::${reloadKey}`

  // Presentation only. `currentPage` remains the single source of truth, this adds no
  // second page state, and nothing here can delay, gate or reorder a render — the
  // transition is presented when a render commits, never awaited by one.
  const { onRenderCommitted } = useNativePdfPageTransition({
    enabled,
    ready: status === 'ready',
    documentKey,
    currentPage,
    totalPages,
    containerRef
  })

  // The shared fit calculation, fed the native path's own page size. Fit is a
  // number computed from the page box and the container box, so this is the same
  // value the scale state applies as an ordinary scale.
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

  // The Electron PDF context menu's Zoom In / Zoom Out / Reset Zoom items. The
  // hook is numeric and imports no viewer package, so the same three actions
  // reach this controller's own rAF-coalesced channel, and `reset` lands on the
  // same numeric fit scale `useNativePdfScaleState#fit` applies. Declared here
  // rather than in the shared state hook so the subscription lives and dies with
  // the native viewer: while `enabled` is false it is inert, and it is the only
  // such subscription in the app.
  usePdfViewerZoomIpc(zoomTo, scale, fitScale, isReady)

  // Ctrl/Cmd + `-` / `=` / `0` are owned here, not by a viewer plugin. All three
  // actions go through the same coalesced channel as every other zoom source.
  usePdfZoomShortcuts({ zoomIn, zoomOut, fit, enabled: isReady })

  // `usePdfResizeRefit` is shared with the rest of the feature and is typed
  // numeric, so its debounce / cooldown / navigation-lock rules are what this
  // viewer relies on. The parameter is taken as `unknown` and narrowed rather
  // than passed straight through, so a non-numeric request can never reach the
  // scale channel. A number is always passed (`fitScale`, or the numeric fallback
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
    scale,
    onRenderCommitted
  })

  const { textLayerError, textLayerReady } = useNativePdfTextLayer({
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

  // Declared last, and that is load-bearing: the search measures the text layer's runs,
  // so on a page change or a zoom the text layer's cleanup — which empties its container
  // synchronously — has to run before this effect decides what to draw.
  const { highlight, clearHighlights, searchError } = useNativePdfSearch({
    enabled,
    searchLayerRef,
    documentKey,
    currentPage,
    scale,
    textLayerReady
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
      highlight,
      clearHighlights,
      searchError,
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
      highlight,
      clearHighlights,
      searchError,
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

/**
 * PDF viewer — public surface of the viewer boundary.
 *
 * ## Where this boundary is
 *
 * Everything that imports `@features/pdf/engine` lives under
 * `features/pdf/native/`, plus `features/pdf/lib/renderPageToImage.ts` (which
 * borrows a capture document from the engine's capture adapter) and
 * `features/pdf/ui/components/NativePdfViewer.tsx`. That is deliberate: the engine
 * is the only place allowed to import PDF.js, and keeping its consumers in one
 * directory makes "who depends on pdfjs" answerable by reading one folder.
 *
 * The dependency direction is `UI → engine → pdfjs-dist`; the reverse is forbidden
 * and is asserted by `src/__tests__/architecture/pdfjs-single-runtime.test.ts`.
 *
 * `nativePdfDom.ts` is the one exception to "pure hooks": it is the viewer's
 * markup contract, kept here so the boundary owns what it emits and the text
 * extractors only have to ask. It imports nothing.
 *
 * ## What is inside
 *
 *  - `nativePdfBounds` — the 1-based page clamp and the numeric zoom clamp
 *  - `nativePdfDom` — the native markup contract, for the text extractors
 *  - `useNativeCoalescedScale` — the one-zoom-per-frame channel
 *  - `useNativePdfEngine` — one document manager + one page renderer per mount
 *  - `useNativePdfDocument` — `(pdfUrl, reloadKey)` → ready document
 *  - `useNativePdfPageState` — 1-based page state, clamped
 *  - `useNativePdfScaleState` — numeric scale state, fit on document identity
 *  - `useNativePdfRender` — one page, one canvas, supersede-cancel
 *  - `useNativePdfTextLayer` — one page, one PDF.js `TextLayer`, supersede-cancel
 *  - `nativePdfLinkService` — PDF.js's link-service surface over the native page state
 *  - `useNativePdfAnnotationLayer` — one page, one PDF.js `AnnotationLayer`
 *  - `nativePdfSearch` — literal matching over the page's runs, and match geometry
 *  - `useNativePdfSearch` — keyword → highlight rectangles in the overlay
 *  - `useNativePdfCaptureDocument` — publishes the mounted document to capture
 *  - `useNativePdfController` — the composition and the toolbar contract
 *  - `nativeZoomControls` — render-prop zoom components for the shared toolbar
 *
 * The capture *adapter* is not here: it is `engine/captureDocument`, because
 * `lib/renderPageToImage.ts` needs it too and only the engine may import PDF.js.
 * It is re-exported below for the viewer's own use.
 */
export { clampPdfPage, clampPdfScale } from './nativePdfBounds'
export {
  findNativeAnnotationLayer,
  findNativeAnnotationLayerForPage,
  findNativePageElement,
  findNativeSearchLayer,
  findNativeSearchLayerForPage,
  findNativeTextLayer,
  findNativeTextLayerForPage,
  isInsideNativeTextLayer,
  NATIVE_ANNOTATION_LAYER_SELECTOR,
  NATIVE_ANNOTATION_LINK_SELECTOR,
  NATIVE_CANVAS_SELECTOR,
  NATIVE_INTERNAL_LINK_SELECTOR,
  NATIVE_PAGE_SELECTOR,
  NATIVE_SEARCH_HIGHLIGHT_SELECTOR,
  NATIVE_SEARCH_LAYER_SELECTOR,
  NATIVE_TEXT_LAYER_SELECTOR,
  NATIVE_TEXT_SPAN_SELECTOR,
  nativeAnnotationLayerSelectorForPage,
  nativePageSelector,
  nativeSearchLayerSelectorForPage,
  nativeTextLayerSelectorForPage
} from './nativePdfDom'
export {
  createNativeZoomControls,
  type NativeZoomControls,
  useNativeZoomControls
} from './nativeZoomControls'
export { type NumericZoomTo, useNativeCoalescedScale } from './useNativeCoalescedScale'
export {
  type NativePdfAnnotationLayerHandle,
  useNativePdfAnnotationLayer
} from './useNativePdfAnnotationLayer'
export { useNativePdfCaptureDocument } from './useNativePdfCaptureDocument'
export { type NativePdfController, useNativePdfController } from './useNativePdfController'
export {
  type NativePdfDocumentStatus,
  type NativePdfPageDimensions,
  useNativePdfDocument
} from './useNativePdfDocument'
export {
  type NativePdfEngine,
  type NativePdfEngineHandle,
  useNativePdfEngine
} from './useNativePdfEngine'
export { type NativePdfPageHandle, useNativePdfPageState } from './useNativePdfPageState'
export { type NativePdfRenderHandle, useNativePdfRender } from './useNativePdfRender'
export { type NativePdfScaleHandle, useNativePdfScaleState } from './useNativePdfScaleState'
export { type NativePdfSearchHandle, useNativePdfSearch } from './useNativePdfSearch'
export { type NativePdfTextLayerHandle, useNativePdfTextLayer } from './useNativePdfTextLayer'
export {
  createNativeCaptureHandle,
  loadTemporaryCaptureDocument,
  type TemporaryCaptureDocument
} from '@features/pdf/engine/captureDocument'

/**
 * Native PDF viewer — public surface of the native boundary.
 *
 * ## Where this boundary is
 *
 * Everything that imports `@features/pdf/engine` lives under
 * `features/pdf/native/` plus the single presentational component
 * `features/pdf/ui/components/NativePdfViewer.tsx`. That is deliberate: the
 * engine is the first thing the migration replaces, and keeping its consumers
 * in one directory makes "who depends on pdfjs 6" answerable by reading one
 * folder. The legacy viewer sources (`PdfViewerElement`, `PdfViewerDocument`'s
 * legacy branch, `PdfWorkerHost`, `usePdfPlugins`, the capture and text
 * pipelines) stay untouched and keep resolving `pdfjs-dist@3.11.174`.
 *
 * The dependency direction is `UI → engine → pdfjs-6`; the reverse is forbidden
 * and is asserted by `src/__tests__/architecture/pdfjs-dual-runtime.test.ts`.
 *
 * `nativePdfDom.ts` is the one exception to "pure hooks": it is the native
 * markup's contract, kept here so the boundary owns what it emits and the text
 * extractors only have to ask. It imports nothing.
 *
 * ## What is inside
 *
 *  - `nativePdfViewerFlag` — the build-time opt-in, default off
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
 *  - `useNativePdfController` — the composition and the toolbar contract
 *  - `nativeZoomControls` — render-prop zoom components for the shared toolbar
 */
export { clampPdfPage, clampPdfScale } from './nativePdfBounds'
export {
  findNativeAnnotationLayer,
  findNativeAnnotationLayerForPage,
  findNativePageElement,
  findNativeTextLayer,
  findNativeTextLayerForPage,
  isInsideNativeTextLayer,
  NATIVE_ANNOTATION_LAYER_SELECTOR,
  NATIVE_ANNOTATION_LINK_SELECTOR,
  NATIVE_CANVAS_SELECTOR,
  NATIVE_INTERNAL_LINK_SELECTOR,
  NATIVE_PAGE_SELECTOR,
  NATIVE_TEXT_LAYER_SELECTOR,
  NATIVE_TEXT_SPAN_SELECTOR,
  nativeAnnotationLayerSelectorForPage,
  nativePageSelector,
  nativeTextLayerSelectorForPage
} from './nativePdfDom'
export {
  isNativePdfViewerEnabled,
  NATIVE_PDF_VIEWER_ENV_KEY,
  readNativePdfViewerFlag
} from './nativePdfViewerFlag'
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
export { type NativePdfTextLayerHandle, useNativePdfTextLayer } from './useNativePdfTextLayer'

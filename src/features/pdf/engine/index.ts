/**
 * Native PDF.js engine — public surface.
 *
 * Everything exported here is React-free, DOM-free and viewer-free: it depends
 * on `pdfjs-6` and plain TypeScript only. The dependency direction is
 *
 *   UI  →  engine  →  pdfjs-6
 *
 * and must stay that way; the reverse is forbidden and is asserted by
 * `src/__tests__/architecture/pdfjs-dual-runtime.test.ts`.
 *
 * ## Migration state
 *
 * This engine is not wired to any UI yet. The shipped viewer is still
 * `@react-pdf-viewer` on `pdfjs-dist@3.11.174`. The viewer phases consume this
 * surface once the dual runtime is torn down.
 *
 * Search is intentionally absent: PDF.js's `PDFFindController` requires the
 * `web/pdf_viewer` event bus and DOM scaffolding, which would drag viewer
 * concerns into the engine. Text extraction and search belong to the text-layer
 * phase, not here.
 */
export { createPdfDocumentManager, type PdfDocumentManager } from './documentManager'
export { createPageCache, type PageSource, type PdfPageCache } from './pageCache'
export {
  createPageRenderer,
  isRenderCancelled,
  type PdfPageRenderer,
  type RenderedPage,
  type RenderPageOptions
} from './pageRenderer'
export {
  createPdfDocumentOptions,
  pdfAssetBaseUrl,
  pdfAssetUrl,
  type PdfDocumentSource,
  PDFJS_ASSET_DIR,
  PDFJS_ASSET_SUBDIRS,
  type PdfjsAssetSubdir,
  type SecureDocumentInitParameters
} from './pdfDocumentOptions'
export {
  initializeNativePdfWorker,
  nativeWorkerUrl,
  resetNativePdfWorkerForTests
} from './pdfWorker'

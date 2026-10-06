/**
 * PDF.js engine — public surface.
 *
 * Everything exported here is React-free, DOM-free and viewer-free: it depends
 * on `pdfjs-dist` and plain TypeScript only. The dependency direction is
 *
 *   UI  →  engine  →  pdfjs-dist
 *
 * and must stay that way; the reverse is forbidden and is asserted by
 * `src/__tests__/architecture/pdfjs-single-runtime.test.ts`.
 *
 * ## What is deliberately not here
 *
 * Search is intentionally absent: PDF.js's `PDFFindController` requires the
 * `web/pdf_viewer` event bus and DOM scaffolding, which would drag viewer
 * concerns into the engine. The search engine lives in `features/pdf/native/`
 * alongside the rest of the viewer.
 *
 * `captureDocument.ts` is the one deliberate addition to a pure engine: it is the
 * engine's public capture/document adapter, because capture needs a PDF.js
 * document and the engine is the only place allowed to import one.
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

/**
 * PDF Workspace Feature — Public API
 *
 * ## Light entry point (this file)
 *
 * Hooks, stores and types that do NOT pull in the heavy PDF rendering
 * stack. Safe to import statically from any module.
 *
 * ## Heavy entry point (./viewer)
 *
 * `PdfViewer` and `PdfTabStrip` — lazy-load these via:
 * ```ts
 * const { PdfViewer, PdfTabStrip } = await import('@features/pdf/viewer')
 * ```
 *
 * ## Type-only entry point (./types)
 *
 * Use `import type { ... } from '@features/pdf/types'` for zero-runtime cost.
 *
 * ## pdfjs-dist version is pinned deliberately
 *
 * There is exactly **one** PDF.js engine and **one** worker in the renderer:
 *
 *   - `@react-pdf-viewer/core` declares `pdfjs-dist` as a *peer dependency* and
 *     its bundle does `require('pdfjs-dist')`, so it runs the very copy npm
 *     installs. It does not bundle a second PDF.js.
 *   - `ui/components/PdfWorkerHost.tsx` feeds that engine a worker URL built from
 *     the same npm `pdfjs-dist` package.
 *   - `lib/renderPageToImage.ts` imports that same package, and normally does not
 *     even load a document: it reuses the live `PDFDocumentProxy` the viewer
 *     registers in `activePdfDocumentRegistry`.
 *
 * The pin exists because engine and worker are the *same* dependency, so an
 * unpinned range could hand the engine a worker from a different major while
 * `npm audit` still called the tree clean. The exact pin is backed by an
 * `overrides` entry and guarded by
 * `src/__tests__/architecture/pdfjs-engine-worker-coupling.test.ts`, which also
 * asserts the installed version satisfies the viewer's declared peer range.
 *
 * To move off pdfjs 3.x, upgrade the viewer and pdfjs in the same change. That
 * additionally requires packaging the `wasm/` assets that 3.x does not have,
 * adding `enableScripting: false` (a later CVE whose knob does not replace the
 * existing `isEvalSupported: false`), and re-verifying the ESM interop shim in
 * `lib/renderPageToImage.ts`.
 */

export { useDriveViewRetirement } from './hooks/useDriveViewRetirement'
export { usePdfOpenActions } from './hooks/usePdfOpenActions'
export { usePdfSelection } from './hooks/usePdfSelection'
export { useReadingProgressPersistence } from './hooks/useReadingProgressPersistence'
export { useShellOpenPdf } from './hooks/useShellOpenPdf'
export { usePdfTabStore } from './store/usePdfTabStore'
export type { ReadingProgressUpdate, ResumePdfResult } from './types'
export { usePdfShortcuts } from './ui/hooks/usePdfShortcuts'

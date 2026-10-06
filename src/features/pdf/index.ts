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
 * ## One PDF.js runtime, pinned deliberately
 *
 * There is exactly one PDF.js in the tree and exactly one worker:
 *
 *   - `pdfjs-dist` is pinned to an exact version — not a range. Engine and worker
 *     are the *same* dependency, so an unpinned range could hand the engine a
 *     worker from a different major while `npm audit` still called the tree clean.
 *   - `engine/pdfWorker.ts` is the single worker source, and the only place that
 *     assigns `GlobalWorkerOptions.workerSrc`.
 *
 * The exact pin is asserted by
 * `src/__tests__/architecture/pdfjs-single-runtime.test.ts`, together with the
 * absence of a second PDF.js under any other name and of the `@react-pdf-viewer`
 * packages.
 *
 * Capture stays on the same runtime: `lib/renderPageToImage.ts` imports no
 * PDF.js at all. It borrows the mounted document from `activePdfDocumentRegistry`
 * and, when there is nothing to borrow, loads one through
 * `engine/captureDocument` — so there is no second `getDocument` options path and
 * no place where the security posture could diverge from the viewer's.
 */

/**
 * App-boot renderer guards.
 *
 * Exported through the barrel because `app/main.tsx` owns the bootstrap: this is
 * a window listener with no React or viewer dependency, so installing it per
 * mounted viewer was the wrong owner — it used to hang off `PdfWorkerHost`, which
 * meant lazily installed, once per viewer, and only while a PDF panel existed.
 */
export { installPdfRenderErrorGuard } from './errors/pdfRenderErrors'
export { useDriveViewRetirement } from './hooks/useDriveViewRetirement'
export { usePdfOpenActions } from './hooks/usePdfOpenActions'
export { usePdfSelection } from './hooks/usePdfSelection'
export { useReadingProgressPersistence } from './hooks/useReadingProgressPersistence'
export { useShellOpenPdf } from './hooks/useShellOpenPdf'
export { usePdfTabStore } from './store/usePdfTabStore'
export type { ReadingProgressUpdate, ResumePdfResult } from './types'
export { usePdfShortcuts } from './ui/hooks/usePdfShortcuts'

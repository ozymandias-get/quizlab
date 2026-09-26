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
 * ## pdfjs-dist is not independently upgradable
 *
 * The renderer ends up with two PDF.js engines and one worker, and the
 * engine/worker handshake crosses the viewer boundary:
 *
 *   - `@react-pdf-viewer/core` webpack-bundles its own PDF.js, so its engine
 *     is the one it shipped with, independent of what npm installs.
 *   - `ui/components/PdfWorkerHost.tsx` passes a worker URL built from the
 *     npm `pdfjs-dist` package into that bundled engine.
 *   - `lib/renderPageToImage.ts` imports a second, separate pdfjs instance
 *     for the fallback page-to-image render.
 *
 * Both sides resolve to the same version today, so it works — by
 * coincidence, not by design. Bumping `pdfjs-dist` on its own would put a
 * newer worker in front of an older engine while `npm audit` called the tree
 * clean, so the version is pinned exactly and guarded by overrides plus
 * `src/__tests__/architecture/pdfjs-engine-worker-coupling.test.ts`.
 *
 * To move off pdfjs 3.x, replace the viewer and upgrade pdfjs in the same
 * change. That additionally requires `enableScripting: false` alongside the
 * existing `isEvalSupported: false` (two different CVEs, neither replaces the
 * other), packaging the `wasm/` assets that 3.x does not have, and
 * re-verifying the ESM interop shim in `lib/renderPageToImage.ts`.
 */

export { usePdfOpenActions } from './hooks/usePdfOpenActions'
export { usePdfSelection } from './hooks/usePdfSelection'
export { useReadingProgressPersistence } from './hooks/useReadingProgressPersistence'
export { useShellOpenPdf } from './hooks/useShellOpenPdf'
export { usePdfTabStore } from './store/usePdfTabStore'
export type { ReadingProgressUpdate, ResumePdfResult } from './types'
export { usePdfShortcuts } from './ui/hooks/usePdfShortcuts'

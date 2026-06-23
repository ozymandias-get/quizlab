/**
 * 📐 PDF Workspace Feature — Public API
 *
 * ## Light entry point (this file)
 *
 * Hooks and types that do NOT pull in the heavy PDF rendering stack.
 * Safe to import statically from any module.
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
 */

export { usePdfSelection } from './hooks/usePdfSelection'

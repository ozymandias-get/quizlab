/**
 * 📐 PDF Workspace Feature — Public API
 *
 * This is the ONLY public entry point for the PDF feature.
 * External consumers MUST import from `@features/pdf` and MUST NOT
 * deep-import into internal modules (e.g. `@features/pdf/capture/...`).
 *
 * ## Public API
 *
 * | Export | Kind | Purpose |
 * |--------|------|---------|
 * | `PdfViewer` | Component | Top-level PDF viewer (lazy-loadable) |
 * | `PdfTabStrip` | Component | PDF tab bar |
 * | `usePdfSelection` | Hook | Tab state, reading progress, open actions |
 * | `usePdfAiActions` | Hook | PDF→AI text/image bridge |
 *
 * ## Internal layers (NOT exported)
 *
 * - `text/`       — Text extraction, selection, normalization
 * - `capture/`    — Screenshot pipeline, blob lifecycle
 * - `ai-bridge/`  — AI transfer standardization
 * - `viewport/`   — Scroll, zoom, resize coordination
 * - `interaction/`— Pan, context menu, pointer modes
 * - `ui/`         — Components and hooks (internal)
 * - `hooks/`      — Tab management, persistence
 * - `constants/`  — Configuration
 */

export { default as PdfTabStrip } from './ui/components/PdfTabStrip'
export { default as PdfViewer } from './ui/components/PdfViewer'
export { usePdfSelection } from './hooks/usePdfSelection'
export { usePdfAiActions } from './ai-bridge'
export type {
  PdfTab,
  LastReadingInfo,
  ResumePdfResult,
  ReadingProgressUpdate
} from './hooks/usePdfSelection'
export type { PdfAiTextSource, PdfAiImageSource } from './ai-bridge/types'
export type { PdfAiTextItemMeta, PdfAiImageItemMeta } from './ai-bridge/types'

/**
 * Numeric bounds shared by the native viewer's page and scale state.
 *
 * Both are pure functions on purpose: they are the rules that the 1-based page
 * contract and the zoom clamps are made of, and a pure function is the cheapest
 * thing to pin with tests.
 *
 * ## Page indexing
 *
 * QuizLab's public page state is **1-based** (`currentPage` in `1..totalPages`,
 * which is what the toolbar renders and what reading progress persists). PDF.js
 * `getPage()` is 1-based too, so nothing on the page path converts: there is no
 * 0-based number to reconcile. The only 0-based value that reaches the viewer
 * arrives by link destination resolution, which converts explicitly before
 * calling `jumpToPage` — see `nativePdfLinkService`.
 */
import { PDF_ZOOM_MAX_SCALE, PDF_ZOOM_MIN_SCALE } from '@features/pdf/constants/pdfZoom'

/**
 * Clamp a 1-based page number into the loaded document.
 *
 * While `totalPages` is still unknown (nothing loaded, or a document switch in
 * flight) there is no upper bound to enforce, so the value is only lower-bounded
 * to `1`. That matters because forcing `1` while the page count is unknown would
 * fight the resume flow, which legitimately restores a page before the new
 * document's `numPages` is known.
 */
export function clampPdfPage(page: number, totalPages: number): number {
  const requested = Number.isFinite(page) ? Math.trunc(page) : 1
  const lowerBounded = Math.max(1, requested)
  if (!Number.isFinite(totalPages) || totalPages <= 0) return lowerBounded
  return Math.min(lowerBounded, Math.trunc(totalPages))
}

/**
 * Clamp a numeric zoom level into the product's zoom range.
 *
 * Every native zoom source (toolbar buttons, Ctrl+wheel, fit) funnels through
 * this, so no path can produce an out-of-range scale — and the bounds are the
 * shared `PDF_ZOOM_*` constants rather than native-local copies. Because the
 * result is fed straight into `setState`, an already-clamped request returns the
 * current value and React bails out of the re-render: pressing zoom-in at the
 * maximum is a no-op rather than a repaint.
 */
export function clampPdfScale(scale: number): number {
  if (!Number.isFinite(scale)) return PDF_ZOOM_MIN_SCALE
  return Math.min(PDF_ZOOM_MAX_SCALE, Math.max(PDF_ZOOM_MIN_SCALE, scale))
}

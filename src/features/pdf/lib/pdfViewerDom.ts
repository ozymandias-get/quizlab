/**
 * The one place that knows @react-pdf-viewer's private DOM.
 *
 * The viewer exposes no API for "give me the element for page N" or "give me the
 * text layer", so capture, text extraction, selection and pan all have to reach
 * into its markup. Keeping those selectors scattered meant a viewer upgrade had
 * to be reconciled in several files that had no reason to know about each other.
 * Everything the app needs from the viewer's DOM is declared here.
 *
 * ## How the selector list was verified
 *
 * Each selector below was checked against the installed
 * `@react-pdf-viewer/core@3.12.0` bundle: the class and attribute names it emits
 * were read straight out of `lib/cjs/core.js`, which declares
 * `VIRTUAL_INDEX_ATTR = 'data-virtual-index'`, `'data-testid': 'core__page-layer-'`
 * and `'data-testid': 'core__inner-container'`, and renders the
 * `rpv-core__page-layer` / `rpv-core__text-layer` classes.
 *
 * Selectors that appeared in earlier versions but have **zero** occurrences in
 * the shipped bundle were removed rather than kept as speculative fallbacks,
 * because a selector that can never match is not a fallback, it is a wasted
 * `querySelector` on every capture and every text extraction:
 *
 *   - `[data-page-number="N"]`   — the viewer never emitted this attribute in v3
 *   - `.pdf-page-wrapper`        — class does not exist in v3
 *   - `.rpv-core__text-layer-basic` — the v2 non-canvas text layer; v3 renders
 *     pages to canvas only, so this class is never applied
 *
 * If a future viewer brings one of them back, restore it here and nowhere else.
 */

/** Class the viewer puts on the element that wraps one rendered page. */
export const PAGE_LAYER_CLASS = 'rpv-core__page-layer'

/** Class of the positioned text spans the viewer renders for a page. */
export const TEXT_LAYER_CLASS = 'rpv-core__text-layer'

/** The scrollable viewport element. */
export const INNER_CONTAINER_SELECTOR = '[data-testid="core__inner-container"]'

/**
 * Selectors that identify the element for `pageNumber` (1-based), most reliable
 * first. Callers keep their own lookup order and caching; this only supplies the
 * strings.
 */
export function pageLayerSelectors(pageNumber: number): string[] {
  const virtualIndex = pageNumber - 1
  return [
    `.${PAGE_LAYER_CLASS}[data-virtual-index="${virtualIndex}"]`,
    `[data-testid="core__page-layer-${virtualIndex}"]`
  ]
}

/** Selector for the text layer inside a page layer. */
export const TEXT_LAYER_SELECTOR = `.${TEXT_LAYER_CLASS}`

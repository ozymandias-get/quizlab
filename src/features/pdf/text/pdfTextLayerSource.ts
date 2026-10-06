/**
 * Where the text extractors find a page's text.
 *
 * ## Why this file still exists
 *
 * `extractPageTextFromDom` and `extractSelectedText` read the DOM, and for six
 * years that DOM belonged to `@react-pdf-viewer`. While the native viewer was
 * being built, this module resolved *two* markups so both extractors stayed
 * renderer-agnostic and neither grew a branch. There is one renderer now, so the
 * indirection has a single answer left.
 *
 * It is kept rather than deleted because it is still the one place that pairs a
 * layer element with the selector that reads its individual text runs — knowledge
 * the extractors would otherwise each have to know. That pairing is not obvious:
 *
 *  - PDF.js 6 nests its text runs inside `span.markedContent` wrappers on a
 *    tagged PDF, so a blanket `span` query would count every word twice — once on
 *    its own run, once on the union rect of a wrapper. `role="presentation"` is
 *    set on the runs and not on the wrappers, so that is the correct selector.
 *  - The page box and its text layer are addressed separately, because a page can
 *    legitimately have no text layer at all (an image-only page, or one whose
 *    layer is still being built).
 *
 * All of it is the native markup's own vocabulary, owned by
 * `native/nativePdfDom.ts`.
 */
import {
  findNativePageElement,
  findNativeTextLayer,
  findNativeTextLayerForPage,
  NATIVE_TEXT_SPAN_SELECTOR
} from '../native/nativePdfDom'

/** A resolved text-layer element plus how to read its individual text runs. */
export interface TextLayerSource {
  /** The layer element itself. */
  layer: HTMLElement
  /** Selector matching one positioned text run inside `layer`. */
  spanSelector: string
}

/**
 * The text layer inside `root`.
 *
 * `root` is the shared viewer container, which is where the layer is mounted.
 */
export function findTextLayerSource(root: ParentNode): TextLayerSource | null {
  const layer = findNativeTextLayer(root)
  return layer ? { layer, spanSelector: NATIVE_TEXT_SPAN_SELECTOR } : null
}

/**
 * The text layer of `pageNumber` (1-based), or `null` when that page is on screen
 * but carries no text layer.
 */
export function findTextLayerSourceForPage(
  root: ParentNode,
  pageNumber: number
): TextLayerSource | null {
  const layer = findNativeTextLayerForPage(root, pageNumber)
  return layer ? { layer, spanSelector: NATIVE_TEXT_SPAN_SELECTOR } : null
}

/**
 * The page box that stands for `pageNumber` (1-based).
 *
 * Used as the page-layer fallback when a page box has no text layer at all — an
 * image-only page, or a page whose text layer is still being built.
 */
export function findPageElementForPage(root: ParentNode, pageNumber: number): HTMLElement | null {
  return findNativePageElement(root, pageNumber)
}

/**
 * Where the text extractors find a page's text.
 *
 * `extractPageTextFromDom` and `extractSelectedText` both read the DOM, and both
 * need the same two answers: which element holds the text, and which selector
 * picks out one text run inside it. That pairing lives here so neither extractor
 * has to know it. It is not obvious:
 *
 *  - PDF.js 6 nests its text runs inside `span.markedContent` wrappers on a
 *    tagged PDF, so a blanket `span` query would count every word twice — once on
 *    its own run, once on the union rect of a wrapper. `role="presentation"` is
 *    set on the runs and not on the wrappers, so that is the correct selector.
 *  - The page box and its text layer are addressed separately, because a page can
 *    legitimately have no text layer at all (an image-only page, or one whose
 *    layer is still being built).
 *
 * The markup this reads is the native viewer's own vocabulary, owned by
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

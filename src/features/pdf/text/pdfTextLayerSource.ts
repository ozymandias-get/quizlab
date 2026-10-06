/**
 * Where the text extractors find a page's text, on either renderer.
 *
 * ## The problem this solves
 *
 * `extractPageTextFromDom` and `extractSelectedText` read the DOM, and for six
 * years that DOM belonged to `@react-pdf-viewer`. From Phase 5 there are two of
 * them — the legacy viewer's `rpv-core__page-layer` / `rpv-core__text-layer`,
 * and the native viewer's `data-native-pdf-page` / `data-native-pdf-text-layer` —
 * while the behaviour built on top (reading order, normalization, the selection
 * pill, the idle-deferred page text) must stay identical on both. So the two
 * pieces of markup knowledge are resolved *here*, once, and both extractors go
 * through the same resolution instead of growing a branch each.
 *
 * ## Which knowledge lives where
 *
 * `lib/pdfViewerDom.ts` owns the RPV selectors and this file owns the rule for
 * *choosing* between the two markups; `native/nativePdfDom.ts` owns the native
 * selectors. Neither renderer leaks into the other: the native half imports the
 * native contract, and the legacy half imports the legacy one.
 *
 * Native is tried first. On the shipped path the native markup is absent, so the
 * legacy lookup runs exactly as it always did; the ordering only matters if both
 * were somehow present, and then the newer, single-page, self-identifying markup
 * is the truthful answer.
 *
 * ## Why a span selector travels with the layer
 *
 * `collectTextItems` reads each match's own `textContent` and
 * `getBoundingClientRect()`. PDF.js 6 nests its text runs inside
 * `span.markedContent` wrappers on a tagged PDF, so a blanket `span` query would
 * count every word twice — once on its own run, once on the union rect of a
 * wrapper. The native half therefore reports `span[role="presentation"]`, which
 * PDF.js sets on the runs and not on the wrappers. The legacy half reports plain
 * `span`, which is what its markup has always been read with.
 */
import { PAGE_LAYER_CLASS, pageLayerSelectors, TEXT_LAYER_SELECTOR } from '../lib/pdfViewerDom'
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
 * The text layer inside `root`, whichever renderer produced it.
 *
 * `root` is the shared viewer container, so a native layer and the legacy layer
 * are both reachable through one call and the caller never branches.
 */
export function findTextLayerSource(root: ParentNode): TextLayerSource | null {
  const nativeLayer = findNativeTextLayer(root)
  if (nativeLayer) return { layer: nativeLayer, spanSelector: NATIVE_TEXT_SPAN_SELECTOR }

  const legacyLayer = root.querySelector<HTMLElement>(TEXT_LAYER_SELECTOR)
  return legacyLayer ? { layer: legacyLayer, spanSelector: 'span' } : null
}

/**
 * The text layer of `pageNumber` (1-based), whichever renderer produced it.
 *
 * `root` is the document, because the legacy lookup is global: RPV's page layers
 * are addressable by `data-virtual-index` anywhere in the document, while the
 * native page box is a single element. Callers that already hold the viewer
 * container get the same answer, because the container is inside the document.
 */
export function findTextLayerSourceForPage(
  root: ParentNode,
  pageNumber: number
): TextLayerSource | null {
  const nativeLayer = findNativeTextLayerForPage(root, pageNumber)
  if (nativeLayer) return { layer: nativeLayer, spanSelector: NATIVE_TEXT_SPAN_SELECTOR }

  const legacyPageLayer = findLegacyPageLayer(root, pageNumber)
  if (!legacyPageLayer) return null

  const legacyLayer = legacyPageLayer.querySelector<HTMLElement>(TEXT_LAYER_SELECTOR)
  return legacyLayer ? { layer: legacyLayer, spanSelector: 'span' } : null
}

/**
 * The element that stands for `pageNumber` (1-based), on either renderer.
 *
 * Used as the page-layer fallback when a renderer produced a page box with no
 * text layer at all — an image-only page, or a page whose text layer is still
 * being built.
 */
export function findPageElementForPage(root: ParentNode, pageNumber: number): HTMLElement | null {
  return findNativePageElement(root, pageNumber) ?? findLegacyPageLayer(root, pageNumber)
}

/**
 * The legacy viewer's page layer, with the lookup order and the single-page
 * fallback it has always had.
 *
 * Kept verbatim from `extractPageTextFromDom`, including the `data-virtual-index`
 * walk and the "one page layer on screen is the requested page" rule that
 * `ViewMode.SinglePage` makes true. It is deliberately *not* re-derived: this is
 * the behaviour the Phase 2 tests pin.
 */
function findLegacyPageLayer(root: ParentNode, pageNumber: number): HTMLElement | null {
  const virtualIndex = pageNumber - 1
  const [byVirtualIndex] = pageLayerSelectors(pageNumber)

  const byVirtual = root.querySelector<HTMLElement>(byVirtualIndex)
  if (byVirtual) return byVirtual

  const allPages = root.querySelectorAll<HTMLElement>(`.${PAGE_LAYER_CLASS}`)
  for (const el of allPages) {
    const vi = el.dataset.virtualIndex
    if (vi && Number(vi) === virtualIndex) return el
  }

  // Single-page view: whatever page is on screen is the requested page.
  if (allPages.length === 1) return allPages[0]

  return null
}

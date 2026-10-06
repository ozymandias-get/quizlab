/**
 * The one place that knows the native viewer's own DOM.
 *
 * ## Why this is the mirror of `lib/pdfViewerDom.ts`
 *
 * The legacy viewer exposes no API for "give me the element for page N" or "give
 * me the text layer", so `lib/pdfViewerDom.ts` declares everything the app needs
 * from *its* private markup. The native viewer does not need a viewer, but it
 * does need the same one-way door for a different reason: once QuizLab owns the
 * text layer, the text extractors have to be able to find it, and the *producer*
 * of that markup should own its selectors rather than the consumers.
 *
 * The two files are deliberately separate. `lib/pdfViewerDom.ts` knows
 * `rpv-core__*`; this file knows nothing about them and emits nothing that would
 * match the legacy stylesheet. A future reader can tell which DOM belongs to
 * which runtime from the file alone.
 *
 * ## The markup contract
 *
 * ```
 * native page container
 * ├── canvas                              (data-native-pdf-canvas)
 * ├── text layer                          (data-native-pdf-text-layer)
 * ├── annotation layer                    (data-native-pdf-annotation-layer)
 * └── search highlight layer              (data-native-pdf-search-layer)
 * ```
 *
 * The first three are PDF.js 6's own: `LAYERS_ORDER` in `web/pdf_viewer.mjs` numbers the
 * page's layers `canvasWrapper` 0, `textLayer` 1, `annotationLayer` 2, and
 * `PDFPageView#addLayer` inserts them in exactly that order. The annotation layer is
 * therefore above the text layer, which is what makes a link clickable while the
 * text underneath stays the selection surface.
 *
 * The search highlight layer is **not** a PDF.js layer — PDF.js's own find highlights are
 * built by `PDFFindController` and handed to a page view, and this viewer declines that
 * whole stack (see `nativePdfSearch.ts`). It is QuizLab's own fourth layer, so it is
 * declared last in the DOM and given `z-index: 1` instead: it paints above the canvas and
 * the text layer and below the annotation layer, which is where a match tint belongs and
 * what keeps a link the topmost thing under the cursor. The DOM order is therefore *not*
 * the paint order here, and it is asserted as an explicit contract rather than left to
 * React's render order.
 *
 * `data-native-pdf-page` is the page's identity and lives on the page container
 * only — the canvas and the text layer are addressed by their own attributes, so
 * "the page element" is never ambiguous.
 *
 * `data-native-pdf-text-page` on the text layer and
 * `data-native-pdf-annotation-page` on the annotation layer carry the same identity,
 * which is what makes "the text of page N" or "the links of page N" a single
 * attribute selector instead of a structural walk. It also gives the races a
 * testable outcome: when a superseded layer is late, the DOM still names the page
 * that is actually on screen.
 *
 * ## The annotation layer's own vocabulary
 *
 * Inside the layer the markup is PDF.js's, not QuizLab's: `section[data-annotation-id]`
 * per annotation, `.linkAnnotation` for links, and `data-internal-link` on the
 * container of a link whose target is *inside* the document. Those three are the
 * installed library's contract rather than a structural detail of our CSS, so the
 * link selectors below are written against them — while the layer itself stays
 * reachable through our own attribute.
 *
 * ## The span selector, and why it is not just `span`
 *
 * PDF.js 6's `TextLayer` emits one `<span role="presentation">` per text item,
 * but for a tagged PDF it also nests those inside `span.markedContent`
 * wrappers while it walks the structure tree. A blanket `span` query therefore
 * returns the wrappers too, and `collectTextItems` — which reads every match's
 * own `textContent` and `getBoundingClientRect()` — would then count every word
 * twice: once on its own span and once on the union rect of its wrapper.
 *
 * `role="presentation"` is set by PDF.js on the text runs and on the `<br>`
 * elements that end a line, and **not** on the `markedContent` wrappers, so it
 * selects exactly the leaves. That is the marker that makes the native layer
 * readable by the same geometry-based collector the legacy path uses.
 *
 * No RPV class name is faked here. The native layer carries its own semantic
 * attributes and its own CSS.
 */

/** The element wrapping one rendered page: canvas plus text layer. */
export const NATIVE_PAGE_SELECTOR = '[data-native-pdf-page]'

/** The single page canvas. */
export const NATIVE_CANVAS_SELECTOR = '[data-native-pdf-canvas]'

/** The PDF.js text layer mounted over the canvas. */
export const NATIVE_TEXT_LAYER_SELECTOR = '[data-native-pdf-text-layer]'

/**
 * The individual positioned text runs inside a native text layer.
 *
 * See the module note: `role="presentation"` is what separates PDF.js's text
 * runs from the `markedContent` wrappers it nests them in.
 */
export const NATIVE_TEXT_SPAN_SELECTOR = `${NATIVE_TEXT_LAYER_SELECTOR} span[role="presentation"]`

/** The PDF.js annotation layer mounted over the canvas and the text layer. */
export const NATIVE_ANNOTATION_LAYER_SELECTOR = '[data-native-pdf-annotation-layer]'

/**
 * Every anchor PDF.js generated inside the annotation layer.
 *
 * PDF.js builds one `<section data-annotation-id>` per annotation and puts a single
 * `<a>` inside the link ones, so this is "the links on this page" without depending
 * on the class names our own stylesheet happens to use.
 */
export const NATIVE_ANNOTATION_LINK_SELECTOR = `${NATIVE_ANNOTATION_LAYER_SELECTOR} a`

/**
 * Only the anchors PDF.js marked as pointing *inside* the document.
 *
 * `LinkAnnotationElement#_bindLink` sets `data-internal-link` on the container only
 * when the destination resolves to something the viewer must handle itself, which is
 * exactly the internal-vs-external distinction a test needs.
 */
export const NATIVE_INTERNAL_LINK_SELECTOR = `${NATIVE_ANNOTATION_LAYER_SELECTOR} [data-internal-link] a`

/**
 * QuizLab's own search highlight overlay, inside the page box.
 *
 * Always present while the native viewer renders — one overlay, emptied and refilled —
 * so the DOM contract does not change shape between "no search" and "no matches" and
 * "many matches". The legacy plugin renders a parallel `rpv-search__highlights` element
 * per page; the name is not reused.
 */
export const NATIVE_SEARCH_LAYER_SELECTOR = '[data-native-pdf-search-layer]'

/** One measured match rectangle inside the overlay. */
export const NATIVE_SEARCH_HIGHLIGHT_SELECTOR = `${NATIVE_SEARCH_LAYER_SELECTOR} [data-native-pdf-search-highlight]`

/** The page selector narrowed to one page (1-based). */
export function nativePageSelector(pageNumber: number): string {
  return `[data-native-pdf-page="${pageNumber}"]`
}

/** The text-layer selector narrowed to one page (1-based). */
export function nativeTextLayerSelectorForPage(pageNumber: number): string {
  return `${NATIVE_TEXT_LAYER_SELECTOR}[data-native-pdf-text-page="${pageNumber}"]`
}

/** The annotation-layer selector narrowed to one page (1-based). */
export function nativeAnnotationLayerSelectorForPage(pageNumber: number): string {
  return `${NATIVE_ANNOTATION_LAYER_SELECTOR}[data-native-pdf-annotation-page="${pageNumber}"]`
}

/** The search-layer selector narrowed to one page (1-based). */
export function nativeSearchLayerSelectorForPage(pageNumber: number): string {
  return `${NATIVE_SEARCH_LAYER_SELECTOR}[data-native-pdf-search-page="${pageNumber}"]`
}

/** The page element for `pageNumber` (1-based), or `null`. */
export function findNativePageElement(root: ParentNode, pageNumber: number): HTMLElement | null {
  return root.querySelector<HTMLElement>(nativePageSelector(pageNumber))
}

/** The text layer for `pageNumber` (1-based), or `null`. */
export function findNativeTextLayerForPage(
  root: ParentNode,
  pageNumber: number
): HTMLElement | null {
  return root.querySelector<HTMLElement>(nativeTextLayerSelectorForPage(pageNumber))
}

/** The text layer under `root`, whatever page it holds. `null` on the legacy path. */
export function findNativeTextLayer(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(NATIVE_TEXT_LAYER_SELECTOR)
}

/** The annotation layer under `root`, whatever page it holds. `null` on the legacy path. */
export function findNativeAnnotationLayer(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(NATIVE_ANNOTATION_LAYER_SELECTOR)
}

/** The annotation layer for `pageNumber` (1-based), or `null`. */
export function findNativeAnnotationLayerForPage(
  root: ParentNode,
  pageNumber: number
): HTMLElement | null {
  return root.querySelector<HTMLElement>(nativeAnnotationLayerSelectorForPage(pageNumber))
}

/** The search overlay under `root`, whatever page it belongs to. `null` on the legacy path. */
export function findNativeSearchLayer(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(NATIVE_SEARCH_LAYER_SELECTOR)
}

/** The search overlay for `pageNumber` (1-based), or `null`. */
export function findNativeSearchLayerForPage(
  root: ParentNode,
  pageNumber: number
): HTMLElement | null {
  return root.querySelector<HTMLElement>(nativeSearchLayerSelectorForPage(pageNumber))
}

/**
 * True when `node` is inside a native text layer that is inside `root`.
 *
 * This is the native half of the selection-scope check: a browser selection is
 * only PDF text if it actually lands on the text layer, so a selection in the
 * toolbar, the AI panel or any other UI is not mistaken for PDF text. The legacy
 * path never consults it, because there the RPV markup is the text layer by
 * construction.
 */
export function isInsideNativeTextLayer(node: Node | null, root: ParentNode): boolean {
  if (!node) return false
  const layer = findNativeTextLayer(root)
  return layer ? layer.contains(node) : false
}

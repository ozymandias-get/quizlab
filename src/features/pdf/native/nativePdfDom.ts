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
 * └── text layer                          (data-native-pdf-text-layer)
 * ```
 *
 * `data-native-pdf-page` is the page's identity and lives on the page container
 * only — the canvas and the text layer are addressed by their own attributes, so
 * "the page element" is never ambiguous.
 *
 * `data-native-pdf-text-page` on the text layer carries the same identity, which
 * is what makes "the text of page N" a single attribute selector instead of a
 * structural walk. It also gives the races a testable outcome: when a superseded
 * layer is late, the DOM still names the page that is actually on screen.
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

/** The page selector narrowed to one page (1-based). */
export function nativePageSelector(pageNumber: number): string {
  return `[data-native-pdf-page="${pageNumber}"]`
}

/** The text-layer selector narrowed to one page (1-based). */
export function nativeTextLayerSelectorForPage(pageNumber: number): string {
  return `${NATIVE_TEXT_LAYER_SELECTOR}[data-native-pdf-text-page="${pageNumber}"]`
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

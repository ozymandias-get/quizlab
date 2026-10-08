/**
 * The one place that knows the native viewer's own DOM.
 *
 * ## Why the selectors live here
 *
 * Once QuizLab owns the text layer, the text extractors have to be able to find
 * it — and a *consumer* of that markup should not be the thing that knows its
 * selector strings. So the producer owns them and everyone else asks here.
 *
 * Every selector in this file is QuizLab's own vocabulary. Nothing here reuses a
 * third-party viewer's class names, and the native layer's stylesheets match
 * `data-native-pdf-*` only, so what the viewer emits and what the CSS styles
 * cannot drift apart behind a foreign naming scheme.
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
 * — the canvas, the annotation layer and the search overlay are addressed by
 * their own attributes, so "the page element" is never ambiguous.
 *
 * It is also what makes a capture safe: `findNativePageCanvas` reads it to confirm
 * the single mounted canvas really holds the page being asked for. On its own it is
 * only half the answer, though — it is React *state*, the page the viewer wants to
 * show — so `data-native-pdf-canvas-page` carries the other half and a capture needs
 * both to agree (see the attribute's own note below).
 *
 * `data-native-pdf-text-page` on the text layer carries the same identity, which is what
 * makes "the text of page N" a single attribute selector instead of a structural walk.
 * It is deliberately the only layer that carries it: the annotation layer takes its page
 * from React state and the search overlay from the page box it is nested in, so neither
 * needs to restate it, and a superseded layer's contents are what make a race testable.
 *
 * ## The annotation layer's own vocabulary
 *
 * Inside the layer the markup is PDF.js's, not QuizLab's: `section[data-annotation-id]`
 * per annotation, `.linkAnnotation` for links, and `data-internal-link` on the
 * container of a link whose target is *inside* the document. Those three are the
 * installed library's contract rather than a structural detail of our CSS, so
 * `nativePdfAnnotationLayer.css` is written against them — while the layer itself stays
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
 * selects exactly the leaves. That is the marker the geometry-based text
 * collector reads, so a word is counted once rather than twice.
 *
 * No third-party class name is faked here. The native layer carries its own
 * semantic attributes and its own CSS.
 */

/** The element wrapping one rendered page: canvas plus text layer. */
export const NATIVE_PAGE_SELECTOR = '[data-native-pdf-page]'

/**
 * The scrollable viewport the page box lives in.
 *
 * `usePdfPanTool` needs this as a fallback: it first walks up from the pointer
 * looking for a scrollable ancestor, and only asks for this when the page does not
 * currently overflow — in which case nothing on the page is a scrollable element
 * and the walk comes back empty. It is also the same element `usePdfCtrlWheelZoom`
 * and `usePdfWheelNavigation` attach to via the shared container's capture phase.
 */
export const NATIVE_SCROLL_SELECTOR = '[data-native-pdf-scroll]'

/** The single page canvas. */
const NATIVE_CANVAS_SELECTOR = '[data-native-pdf-canvas]'

/**
 * The page the canvas is actually *holding*, as opposed to the page the viewer wants
 * to show.
 *
 * `pageRenderer` never clears the canvas — deliberately, see `AGENT_HANDOFF.md`
 * Known Issue 22 — so a same-size page turn keeps the outgoing page's pixels on
 * screen until the incoming render commits, and a zoom keeps the outgoing page's
 * pixels while the backing store has already been resized. Meanwhile
 * `data-native-pdf-page` has already flipped to the new page: it is React state, so
 * it changes on commit while the pixels do not.
 *
 * That interval is the whole reason this attribute exists. `useNativePdfRender`
 * removes it when a render starts and writes it back only once the render commits,
 * so `findNativePageCanvas` can tell "the page box says N" from "the canvas holds N"
 * and refuse the answer in between. Without it, a capture taken during a page turn
 * sends the previous page's image labelled with the new page's number.
 */
export const NATIVE_CANVAS_PAGE_ATTRIBUTE = 'data-native-pdf-canvas-page'

/** The PDF.js text layer mounted over the canvas. */
const NATIVE_TEXT_LAYER_SELECTOR = '[data-native-pdf-text-layer]'

/**
 * The individual positioned text runs inside a native text layer.
 *
 * See the module note: `role="presentation"` is what separates PDF.js's text
 * runs from the `markedContent` wrappers it nests them in.
 */
export const NATIVE_TEXT_SPAN_SELECTOR = `${NATIVE_TEXT_LAYER_SELECTOR} span[role="presentation"]`

/*
 * The annotation layer and the search overlay have no selector constant here, and
 * that is deliberate: neither is ever looked up by query. Both are written by React
 * and reached through the refs the controller holds, which the search hook passes
 * straight into `nativePdfSearch.ts#findNativeSearchPageBox`. A constant nothing
 * queries would only be a second place to keep in sync.
 */

/** The page selector narrowed to one page (1-based). */
function nativePageSelector(pageNumber: number): string {
  return `[data-native-pdf-page="${pageNumber}"]`
}

/** The text-layer selector narrowed to one page (1-based). */
function nativeTextLayerSelectorForPage(pageNumber: number): string {
  return `${NATIVE_TEXT_LAYER_SELECTOR}[data-native-pdf-text-page="${pageNumber}"]`
}

/** The page element for `pageNumber` (1-based), or `null`. */
export function findNativePageElement(root: ParentNode, pageNumber: number): HTMLElement | null {
  return root.querySelector<HTMLElement>(nativePageSelector(pageNumber))
}

/**
 * The mounted page canvas for `pageNumber` (1-based), or `null`.
 *
 * This is the native half of "which on-screen canvas belongs to page N", and it is
 * the reason the capture fallback can work on this path at all: the native viewer
 * keeps exactly **one** canvas, so the page identity on the wrapping
 * `[data-native-pdf-page]` is the only thing that can tell a valid lookup from a
 * wrong-page match. Asking for a page that is not on screen answers `null` rather
 * than handing back the current page's pixels under the wrong label.
 *
 * Two content-independent checks, and both of them have to hold:
 *
 *  - **size** — `useCanvasGpuCleanup` releases a canvas by zeroing it, and a
 *    released canvas is not capturable.
 *  - **committed page** — the page box names the page the viewer is asking for,
 *    while the canvas has to confirm it is *holding* it. A canvas whose render has
 *    not committed yet still shows the previous page, so handing it back would
 *    label the previous page's image with the new page's number. See
 *    `NATIVE_CANVAS_PAGE_ATTRIBUTE`.
 *
 * `null` is a legitimate answer on both counts: the caller falls back to rendering
 * the page from the document itself.
 */
export function findNativePageCanvas(
  root: ParentNode,
  pageNumber: number
): HTMLCanvasElement | null {
  const page = findNativePageElement(root, pageNumber)
  if (!page) return null
  const canvas = page.querySelector<HTMLCanvasElement>(NATIVE_CANVAS_SELECTOR)
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null
  if (canvas.getAttribute(NATIVE_CANVAS_PAGE_ATTRIBUTE) !== String(pageNumber)) return null
  return canvas
}

/** The text layer for `pageNumber` (1-based), or `null`. */
export function findNativeTextLayerForPage(
  root: ParentNode,
  pageNumber: number
): HTMLElement | null {
  return root.querySelector<HTMLElement>(nativeTextLayerSelectorForPage(pageNumber))
}

/**
 * The text layer under `root`, whatever page it holds. `null` when none is mounted.
 *
 * This is the selection-scope check's only entry point: a browser selection is PDF
 * text only if it actually lands on the text layer, so a selection in the toolbar,
 * the AI panel or any other UI sharing the panel is not mistaken for PDF text.
 * `text/extractSelectedText.ts#selectionBelongsToTextLayer` is the caller.
 */
export function findNativeTextLayer(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(NATIVE_TEXT_LAYER_SELECTOR)
}

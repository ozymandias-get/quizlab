/**
 * Extracts selected text from the DOM and computes its screen position.
 * Replaces the inline selection logic in usePdfTextSelection.
 *
 * The geometry, the reading order, the fallback to `selection.toString()`, the
 * pill placement and the out-of-container bail-out below are unchanged. The
 * *lookup* goes through `./pdfTextLayerSource`, and a selection is only accepted
 * as PDF text when it actually lands on the live text layer — see
 * `selectionBelongsToTextLayer`.
 */
import { findNativeTextLayer } from '../native/nativePdfDom'
import { orderTextItems } from './extractPageTextFromDom'
import { normalizePdfText } from './normalizePdfText'
import { findTextLayerSource } from './pdfTextLayerSource'
import type { PdfTextItem, SelectionPosition } from './types'

function isNodeInsideContainer(node: Node | null, container: HTMLElement): boolean {
  return !!node && container.contains(node)
}

function doesRectOverlapContainer(rect: DOMRect, container: HTMLElement): boolean {
  const containerRect = container.getBoundingClientRect()
  if (containerRect.width === 0 || containerRect.height === 0) return false

  return !(
    rect.right < containerRect.left ||
    rect.left > containerRect.right ||
    rect.bottom < containerRect.top ||
    rect.top > containerRect.bottom
  )
}

interface SelectionExtractResult {
  text: string
  position: SelectionPosition | null
}

/**
 * Is this selection PDF text rather than UI text?
 *
 * The container-level check below already rejects the toolbar, the AI panel and
 * everything else outside the viewer. What it cannot reject on its own is a
 * selection *inside* the viewer that did not come from the page text — the
 * canvas, the page box, or anything else that shares the panel with it.
 *
 * The text layer is a real, addressable element, so the selection has to touch
 * it: one of the range's endpoints or its common ancestor inside the layer. A
 * selection that lands anywhere else — the toolbar, the AI panel, any other UI
 * sharing the document — is not PDF text. The check is unconditional: with no
 * text layer mounted there is no PDF text to select.
 */
function selectionBelongsToTextLayer(
  range: Range,
  selection: Selection,
  container: HTMLElement
): boolean {
  const nativeLayer = findNativeTextLayer(container)
  if (!nativeLayer) return false

  return (
    nativeLayer.contains(range.commonAncestorContainer) ||
    nativeLayer.contains(selection.anchorNode) ||
    nativeLayer.contains(selection.focusNode)
  )
}

/**
 * The part of `node` that `range` actually covers, or `null` when they are disjoint.
 *
 * This is the only place the *extent* of a selection is decided, and it is decided
 * by the browser's own `Range` rather than by geometry. The distinction matters:
 * a run's box says where the run is, not how much of it the reader dragged over,
 * and PDF.js emits one run per PDF text item — frequently a whole line, sometimes
 * a whole numbered clause. `orderTextItems` still needs the box to work out reading
 * order; nothing about the box can say what was selected.
 *
 * ## The boundary-point constants do not read the way they are named
 *
 * `Range#compareBoundaryPoints(how, thatRange)` compares one boundary of `this`
 * against one boundary of `thatRange`, but which boundary is which is the opposite
 * of what the constant names suggest. Measured, for a range sitting *inside* the
 * node's contents:
 *
 * ```
 *   START_TO_START  ->  this.start  vs that.start
 *   START_TO_END    ->  this.end    vs that.start      (not this.start vs that.end)
 *   END_TO_END      ->  this.end    vs that.end
 *   END_TO_START    ->  this.start  vs that.end        (not this.end vs that.start)
 * ```
 *
 * So the two comparisons that decide disjointness are `END_TO_END`-adjacent
 * in intent but are spelled `START_TO_END` and `END_TO_START`, and getting them
 * backwards makes every run inside the selection look disjoint — which is a silent
 * failure, not a crash: extraction quietly falls back to `selection.toString()`.
 * Hence the explicit names below.
 */
function selectedContentsOf(range: Range, node: Node): Range | null {
  const whole = document.createRange()
  whole.selectNodeContents(node)

  // This range ends before the node's contents begin.
  const rangeEndsBeforeNodeStarts = range.compareBoundaryPoints(Range.START_TO_END, whole) < 0
  // The node's contents end before this range begins.
  const nodeEndsBeforeRangeStarts = range.compareBoundaryPoints(Range.END_TO_START, whole) > 0
  if (rangeEndsBeforeNodeStarts || nodeEndsBeforeRangeStarts) return null

  // The intersection starts at whichever start is later and ends at whichever end
  // is earlier, so each boundary is taken from one range or from the other.
  const rangeStartsLater = range.compareBoundaryPoints(Range.START_TO_START, whole) > 0
  const rangeEndsEarlier = range.compareBoundaryPoints(Range.END_TO_END, whole) < 0

  const covered = document.createRange()
  covered.setStart(
    rangeStartsLater ? range.startContainer : whole.startContainer,
    rangeStartsLater ? range.startOffset : whole.startOffset
  )
  covered.setEnd(
    rangeEndsEarlier ? range.endContainer : whole.endContainer,
    rangeEndsEarlier ? range.endOffset : whole.endOffset
  )
  return covered
}

/**
 * The runs the selection touches, each carrying only the characters it covers.
 *
 * The layer's whole box is walked every time — PDF.js owns this DOM and its runs
 * come and go on every zoom, so there is nothing stable to cache — but the cost
 * is one `Range` comparison per run and **no layout read at all**: `getBoundingClientRect`
 * is here because `orderTextItems` needs it to order columns, not to decide what is
 * selected. That is also cheaper than the rectangle-overlap test this replaced,
 * which called `getClientRects()` once and then intersected every run with every
 * selection rect.
 *
 * The box is measured *before* the run is handed to the range, which keeps a
 * text layer that has not been laid out (no boxes at all) on the `selection.toString()`
 * fallback path without asking the range about anything.
 */
function collectSelectedTextItems(
  range: Range,
  layer: HTMLElement,
  spanSelector: string
): PdfTextItem[] {
  const items: PdfTextItem[] = []
  for (const span of layer.querySelectorAll<HTMLElement>(spanSelector)) {
    const rect = span.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue

    const covered = selectedContentsOf(range, span)
    if (!covered) continue

    const text = covered.toString().trim()
    if (!text) continue

    items.push({ text, left: rect.left, top: rect.top, width: rect.width, height: rect.height })
  }
  return items
}

/**
 * Rebuilds selected text in visual reading order.
 *
 * `selection.toString()` returns the text in DOM (content-stream) order, which
 * interleaves left/right column lines on two-column PDF pages. Instead we take the
 * text-layer spans the range covers and re-order them by (column cluster, Y)
 * exactly like extractPageTextFromDom does for whole pages.
 *
 * What each span contributes is the range's own intersection with it, so a drag
 * that covers three words of one run yields those three words rather than the run.
 * Only the *order* is geometric; the *extent* is the browser's.
 */
function extractOrderedSelectionText(range: Range, container: HTMLElement): string | null {
  const source = findTextLayerSource(container)
  if (!source) return null

  const items = collectSelectedTextItems(range, source.layer, source.spanSelector)
  if (items.length === 0) return null

  const lines = orderTextItems(items)
  const text = lines.join('\n')
  return text || null
}

export function extractSelectedText(
  selection: Selection | null,
  container: HTMLElement
): SelectionExtractResult | null {
  const rawText = selection?.toString().trim()

  if (
    !selection ||
    selection.isCollapsed ||
    !rawText ||
    rawText.length === 0 ||
    selection.rangeCount === 0
  ) {
    return { text: '', position: null }
  }

  const range = selection.getRangeAt(0)
  const commonAncestorInside = isNodeInsideContainer(range.commonAncestorContainer, container)
  const anchorInside = isNodeInsideContainer(selection.anchorNode, container)
  const focusInside = isNodeInsideContainer(selection.focusNode, container)
  const rect = range.getBoundingClientRect()
  const overlapsContainer = doesRectOverlapContainer(rect, container)

  if (
    !commonAncestorInside &&
    !(anchorInside && focusInside) &&
    !(overlapsContainer && (anchorInside || focusInside))
  ) {
    return null
  }

  if (!selectionBelongsToTextLayer(range, selection, container)) {
    return null
  }

  if (rect.width === 0 && rect.height === 0) {
    return { text: '', position: null }
  }

  // Prefer coordinate-ordered text for multi-column pages; the raw selection
  // string is the fallback when the text layer is unavailable or the ordering
  // produced nothing.
  const orderedText = extractOrderedSelectionText(range, container)
  const text = orderedText ? normalizePdfText(orderedText) : normalizePdfText(rawText)

  const selWidth = rect.width
  const selHeight = rect.height

  const clientRects = typeof range.getClientRects === 'function' ? [...range.getClientRects()] : []
  const endRect = clientRects.length > 0 ? clientRects[clientRects.length - 1] : rect

  const pillWidth = 280
  const pillHeight = 44
  const margin = 8
  const bottomBarHeight = 80

  let top = endRect.bottom + margin
  let left = rect.left + rect.width / 2

  if (top + pillHeight > window.innerHeight - bottomBarHeight - margin) {
    const topPosition = endRect.top - pillHeight - margin
    if (topPosition >= margin) {
      top = topPosition
    } else {
      top = Math.max(margin, window.innerHeight - bottomBarHeight - pillHeight - margin)
    }
  }

  if (top < margin) {
    top = endRect.bottom + margin
  }

  if (left < pillWidth / 2 + margin) {
    left = pillWidth / 2 + margin
  }

  if (left > window.innerWidth - pillWidth / 2 - margin) {
    left = window.innerWidth - pillWidth / 2 - margin
  }

  return { text, position: { top, left, width: selWidth, height: selHeight } }
}

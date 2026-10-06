/**
 * Extracts selected text from the DOM and computes its screen position.
 * Replaces the inline selection logic in usePdfTextSelection.
 *
 * ## Two renderers, one selection contract
 *
 * The geometry, the reading order, the fallback to `selection.toString()`, the
 * pill placement and the out-of-container bail-out below are unchanged and are
 * pinned by the Phase 2 suite. What Phase 5 adds is that the *lookup* works on
 * both markups (`./pdfTextLayerSource`), and that a selection is only accepted as
 * PDF text when it actually lands on the live text layer — see
 * `selectionBelongsToTextLayer`.
 */
import { findNativeTextLayer } from '../native/nativePdfDom'
import { collectTextItems, orderTextItems } from './extractPageTextFromDom'
import { normalizePdfText } from './normalizePdfText'
import { findTextLayerSource } from './pdfTextLayerSource'
import type { SelectionPosition } from './types'

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
 * canvas, the page box, or (once the native viewer mounts one) anything that
 * shares the panel with it.
 *
 * The text layer is a real, addressable element, so the selection has to touch
 * it: one of the range's endpoints or its common ancestor inside the layer. A
 * selection that lands anywhere else — the toolbar, the AI panel, any other UI
 * sharing the document — is not PDF text.
 *
 * While the legacy viewer was still shipped this had a bypass for the case where
 * no native layer was mounted, because the legacy markup *was* the text layer by
 * construction. There is one renderer now, so the check is unconditional.
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
 * Rebuilds selected text in visual reading order.
 *
 * `selection.toString()` returns the text in DOM (content-stream) order, which
 * interleaves left/right column lines on two-column PDF pages. Instead we
 * gather the text-layer spans the range actually covers and re-order them by
 * (column cluster, Y) exactly like extractPageTextFromDom does for whole pages.
 */
function extractOrderedSelectionText(range: Range, container: HTMLElement): string | null {
  const source = findTextLayerSource(container)
  if (!source) return null

  const allItems = collectTextItems(source.layer, source.spanSelector)
  if (allItems.length === 0) return null

  const rangeRects = [...range.getClientRects()]
  if (rangeRects.length === 0) return null

  const intersectsRange = (item: { left: number; top: number; width: number; height: number }) => {
    const itemRight = item.left + item.width
    const itemBottom = item.top + item.height
    return rangeRects.some(
      (r) => item.left < r.right && itemRight > r.left && item.top < r.bottom && itemBottom > r.top
    )
  }

  const items = allItems.filter(intersectsRange)
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

/**
 * Extracts selected text from the DOM and computes its screen position.
 * Replaces the inline selection logic in usePdfTextSelection.
 */
import { collectTextItems, orderTextItems } from './extractPageTextFromDom'
import { normalizePdfText } from './normalizePdfText'
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
 * Rebuilds selected text in visual reading order.
 *
 * `selection.toString()` returns the text in DOM (content-stream) order, which
 * interleaves left/right column lines on two-column PDF pages. Instead we
 * gather the text-layer spans the range actually covers and re-order them by
 * (column cluster, Y) exactly like extractPageTextFromDom does for whole pages.
 */
function extractOrderedSelectionText(range: Range, container: HTMLElement): string | null {
  const textLayer = container.querySelector<HTMLElement>(
    '.rpv-core__text-layer, .rpv-core__text-layer-basic'
  )
  if (!textLayer) return null

  const allItems = collectTextItems(textLayer)
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

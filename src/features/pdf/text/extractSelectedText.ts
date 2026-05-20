/**
 * Extracts selected text from the DOM and computes its screen position.
 * Replaces the inline selection logic in usePdfTextSelection.
 */
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

export function extractSelectedText(
  selection: Selection | null,
  container: HTMLElement
): SelectionExtractResult | null {
  const text = selection?.toString().trim()

  if (
    !selection ||
    selection.isCollapsed ||
    !text ||
    text.length === 0 ||
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

  const btnWidth = 140
  const btnHeight = 44
  const margin = 10
  const bottomBarHeight = 80

  let top = rect.top - btnHeight - margin
  let left = rect.left + rect.width / 2

  if (top < margin) {
    top = rect.bottom + margin
  }

  if (top + btnHeight > window.innerHeight - bottomBarHeight - margin) {
    const topPosition = rect.top - btnHeight - margin
    if (topPosition >= margin) {
      top = topPosition
    } else {
      top = Math.max(margin, window.innerHeight - bottomBarHeight - btnHeight - margin)
    }
  }

  if (left < btnWidth / 2 + margin) {
    left = btnWidth / 2 + margin
  }

  if (left > window.innerWidth - btnWidth / 2 - margin) {
    left = window.innerWidth - btnWidth / 2 - margin
  }

  return { text, position: { top, left } }
}

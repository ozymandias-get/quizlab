/**
 * Extracts text content from a specific PDF page's DOM layer.
 * Module-level cache for page layer lookups (cache invalidation is caller's responsibility).
 */
import { normalizePdfText } from './normalizePdfText'

const PAGE_LAYER_CACHE = new Map<number, HTMLElement>()

function getPageLayer(pageNumber: number): HTMLElement | null {
  const cached = PAGE_LAYER_CACHE.get(pageNumber)
  if (cached && cached.isConnected) return cached

  const virtualIndex = pageNumber - 1

  const byVirtual = document.querySelector<HTMLElement>(
    `.rpv-core__page-layer[data-virtual-index="${virtualIndex}"]`
  )

  if (byVirtual) {
    PAGE_LAYER_CACHE.set(pageNumber, byVirtual)
    return byVirtual
  }

  const byAttr = document.querySelector<HTMLElement>(
    `.rpv-core__page-layer[data-page-number="${pageNumber}"]`
  )

  if (byAttr) {
    PAGE_LAYER_CACHE.set(pageNumber, byAttr)
    return byAttr
  }

  const allPages = document.querySelectorAll<HTMLElement>('.rpv-core__page-layer')
  for (const el of allPages) {
    const vi = el.dataset.virtualIndex
    if (vi && Number(vi) === virtualIndex) {
      PAGE_LAYER_CACHE.set(pageNumber, el)
      return el
    }
  }

  if (allPages.length === 1) {
    const onlyPage = allPages[0]
    PAGE_LAYER_CACHE.set(pageNumber, onlyPage)
    return onlyPage
  }

  return null
}

/**
 * Characters that indicate pdfjs-dist CMap/encoding corruption.
 * Used as a signal to fall back to innerText (which includes
 * ::before pseudo-element content with correct characters).
 */
const CORRUPTION_INDICATORS = /[\u00B8\u02C6\u02DC]/

interface TextItem {
  text: string
  left: number
  top: number
  width: number
  height: number
}

/**
 * Collects positioned text items from a pdf.js text layer.
 *
 * The text layer is a flat list of absolutely-positioned spans. On two-column
 * layouts the DOM order is the PDF content-stream order (top-left block, then
 * top-right block), so a naive vertical sort interleaves the two columns
 * sentence-by-sentence. We cluster the items by X position first (column
 * detection) and sort by Y within each column to reconstruct the reading order.
 */
function collectTextItems(layer: HTMLElement): TextItem[] {
  const items: TextItem[] = []
  const spans = layer.querySelectorAll<HTMLElement>('span')
  for (const span of spans) {
    const text = (span.textContent || '').trim()
    if (!text) continue
    const rect = span.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    items.push({ text, left: rect.left, top: rect.top, width: rect.width, height: rect.height })
  }
  return items
}

/**
 * Groups text items into visual columns by X position, then sorts each column
 * by Y. Returns lines of text in reading order (columns top-to-bottom, left
 * to right).
 */
function orderTextItems(items: TextItem[]): string[] {
  if (items.length === 0) return []

  // Sort by horizontal position so column gaps are easy to detect.
  const sorted = [...items].sort((a, b) => a.left - b.left)

  // Column detection: a new column starts when the next item's left edge is
  // farther right than the running column's right edge plus a gap threshold.
  // The threshold is derived from the median item width so narrow columns in
  // dense pages still split correctly.
  const widths = sorted.map((i) => i.width).sort((a, b) => a - b)
  const medianWidth = widths[Math.floor(widths.length / 2)] || 1
  const gapThreshold = Math.max(8, medianWidth * 0.6)

  const columns: TextItem[][] = []
  let currentColumn: TextItem[] = []
  let columnRight = -Infinity

  for (const item of sorted) {
    if (currentColumn.length === 0 || item.left <= columnRight + gapThreshold) {
      currentColumn.push(item)
      columnRight = Math.max(columnRight, item.left + item.width)
    } else {
      columns.push(currentColumn)
      currentColumn = [item]
      columnRight = item.left + item.width
    }
  }
  if (currentColumn.length > 0) columns.push(currentColumn)

  const lines: string[] = []
  for (const column of columns) {
    const sortedColumn = [...column].sort((a, b) => a.top - b.top)

    // Group items on the same visual line (their tops are within a line-height
    // tolerance) and join them with spaces; separate lines with newlines.
    let lineItems: TextItem[] = []
    let lineTop = -Infinity
    const flushLine = () => {
      if (lineItems.length === 0) return
      lineItems.sort((a, b) => a.left - b.left)
      lines.push(lineItems.map((i) => i.text).join(' '))
      lineItems = []
    }

    for (const item of sortedColumn) {
      if (
        lineItems.length === 0 ||
        Math.abs(item.top - lineTop) <= Math.max(3, item.height * 0.6)
      ) {
        lineItems.push(item)
        lineTop = lineItems.length === 1 ? item.top : (lineTop + item.top) / 2
      } else {
        flushLine()
        lineItems = [item]
        lineTop = item.top
      }
    }
    flushLine()
  }

  return lines
}

/**
 * Collects text from a DOM element.
 *
 * Performance strategy:
 * 1. Fast path: use textContent (no style computation). If no corruption
 *    indicators found, return immediately — this covers the vast majority
 *    of well-encoded PDFs.
 * 2. Slow path: if corruption is detected, use innerText instead.
 *    innerText reads the rendered text tree (including ::before/::after
 *    pseudo-elements) in a single batched layout pass, which is orders
 *    of magnitude faster than calling getComputedStyle(span, '::before')
 *    individually on hundreds of spans (each call forces a synchronous
 *    style recalculation).
 */
function collectTextFromElement(el: HTMLElement): string {
  // Fast path — no style computation, no DOM traversal
  const fastText = el.textContent?.trim() || ''
  if (fastText && fastText.length > 5 && !CORRUPTION_INDICATORS.test(fastText)) {
    return fastText
  }

  // Slow path: innerText reads rendered text including pseudo-elements
  // in a single batched layout pass (much cheaper than per-span
  // getComputedStyle calls).
  const renderedText = el.innerText?.trim() || ''
  if (renderedText && renderedText.length > 5) {
    return renderedText
  }

  // Ultimate fallback — collect from all text nodes
  const parts: string[] = []
  const spans = el.querySelectorAll('span')
  for (const span of spans) {
    const text = span.textContent?.trim()
    if (text) parts.push(text)
  }
  if (parts.length > 0) return parts.join(' ')

  return fastText || renderedText
}

export function extractPageTextFromDom(pageNumber: number): string | null {
  const pageLayer = getPageLayer(pageNumber)
  if (!pageLayer) return null

  const textLayer = pageLayer.querySelector<HTMLElement>(
    '.rpv-core__text-layer, .rpv-core__text-layer-basic'
  )

  if (textLayer) {
    // Coordinate-aware extraction first: preserves the reading order of
    // multi-column pages instead of the (mangled) content-stream order.
    const items = collectTextItems(textLayer)
    if (items.length > 0) {
      const orderedLines = orderTextItems(items)
      const orderedText = orderedLines.join('\n')
      if (orderedText && orderedText.length > 5) {
        return normalizePdfText(orderedText)
      }
    }

    const text = collectTextFromElement(textLayer)
    if (text && text.length > 5) return normalizePdfText(text)
  }

  const text = collectTextFromElement(pageLayer)
  if (text && text.length > 5) return normalizePdfText(text)

  return null
}

export function invalidatePageCache(pageNumber: number): void {
  PAGE_LAYER_CACHE.delete(pageNumber)
}

export type { TextItem }
export { collectTextItems, orderTextItems }

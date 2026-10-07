/**
 * Extracts text content from a specific PDF page's DOM layer.
 *
 * Selectors are resolved by `./pdfTextLayerSource`, which pairs the native
 * viewer's `data-native-pdf-*` markup with the selector that reads that marker's
 * individual text runs, and reports whether a page carries a text layer at all.
 * The ordering, the normalization and the fast/slow path below are unchanged
 * behaviour.
 *
 * Cache ownership: `PAGE_LAYER_CACHE` is keyed by page number and every hit is
 * re-checked with `isConnected`, so a page layer that pdf.js detached (page
 * change, document switch, reload) is re-resolved instead of returned stale.
 * Callers additionally drive `invalidatePageCache` on reload.
 */
import { normalizePdfText } from './normalizePdfText'
import {
  findPageElementForPage,
  findTextLayerSourceForPage,
  type TextLayerSource
} from './pdfTextLayerSource'

const PAGE_LAYER_CACHE = new Map<number, HTMLElement>()

function cacheAndReturn(pageNumber: number, element: HTMLElement): HTMLElement {
  PAGE_LAYER_CACHE.set(pageNumber, element)
  return element
}

/**
 * The page element for `pageNumber`, cached by page number.
 *
 * The cache holds only the page box, not the text layer inside it: the text
 * layer is replaced on every zoom and on every re-render, so caching it would
 * hand back a layer that belongs to a previous scale.
 */
function getPageLayer(pageNumber: number): HTMLElement | null {
  const cached = PAGE_LAYER_CACHE.get(pageNumber)
  if (cached && cached.isConnected) return cached

  const resolved = findPageElementForPage(document, pageNumber)
  return resolved ? cacheAndReturn(pageNumber, resolved) : null
}

/**
 * Characters that, when present in a text layer, mark the page as worth a second
 * look: each is unusual in running prose but a real character in some orthography
 * (U+00B8 is the Latin-1 cedilla used in French/Catalan and as a currency symbol,
 * U+02C6 in Sami orthographies, U+02DC in Turkic transliteration).
 *
 * This is only a trigger for the innerText retry below, NOT a known pdf.js
 * corruption detector. `pdfjs-dist` (6.4.299, and the 3.x it replaced) contains
 * no ::before/beforeCSS text-layer mechanism -- the spans come straight from
 * getTextContent()'s item.str -- so there is no rendering-time fix-up for this to
 * recover, and nothing here attempts to rewrite the characters.
 */
const SUSPICIOUS_GLYPH_RUN = /[¸ˆ˜]/

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
 *
 * `spanSelector` is the renderer's own marker for one text run — see
 * `./pdfTextLayerSource` for why it is not simply `span` everywhere.
 */
function collectTextItems(layer: HTMLElement, spanSelector: string): TextItem[] {
  const items: TextItem[] = []
  const spans = layer.querySelectorAll<HTMLElement>(spanSelector)
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
 * 1. Fast path: textContent (no style computation, no layout). Returned
 *    immediately unless the text is very short or contains a suspicious glyph
 *    run — this covers the vast majority of PDFs.
 * 2. Slow path: innerText, which reflects rendered text semantics. It costs one
 *    batched layout pass instead of per-span getComputedStyle calls, so it stays
 *    cheap even for pages with hundreds of spans.
 */
function collectTextFromElement(el: HTMLElement): string {
  // Fast path — no style computation, no DOM traversal
  const fastText = el.textContent?.trim() || ''
  if (fastText && fastText.length > 5 && !SUSPICIOUS_GLYPH_RUN.test(fastText)) {
    return fastText
  }

  // Slow path: innerText reflects rendered text, in one batched layout pass
  // (much cheaper than per-span getComputedStyle calls).
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

  const source: TextLayerSource | null = findTextLayerSourceForPage(document, pageNumber)

  if (source) {
    // Coordinate-aware extraction first: preserves the reading order of
    // multi-column pages instead of the (mangled) content-stream order.
    const items = collectTextItems(source.layer, source.spanSelector)
    if (items.length > 0) {
      const orderedLines = orderTextItems(items)
      const orderedText = orderedLines.join('\n')
      if (orderedText && orderedText.length > 5) {
        return normalizePdfText(orderedText)
      }
    }

    const text = collectTextFromElement(source.layer)
    if (text && text.length > 5) return normalizePdfText(text)
  }

  const text = collectTextFromElement(pageLayer)
  if (text && text.length > 5) return normalizePdfText(text)

  return null
}

export function invalidatePageCache(pageNumber: number): void {
  PAGE_LAYER_CACHE.delete(pageNumber)
}

export { collectTextItems, orderTextItems }

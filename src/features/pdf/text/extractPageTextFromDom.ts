/**
 * Extracts text content from a specific PDF page's DOM layer.
 *
 * Selectors come from `../lib/pdfViewerDom`, the single owner of the viewer's
 * private DOM; the lookup order and caching below are specific to text
 * extraction.
 *
 * Cache ownership: `PAGE_LAYER_CACHE` is keyed by page number and every hit is
 * re-checked with `isConnected`, so a page layer that pdf.js detached (page
 * change, document switch, reload) is re-resolved instead of returned stale.
 * Callers additionally drive `invalidatePageCache` on reload.
 */
import { PAGE_LAYER_CLASS, pageLayerSelectors, TEXT_LAYER_SELECTOR } from '../lib/pdfViewerDom'
import { normalizePdfText } from './normalizePdfText'

const PAGE_LAYER_CACHE = new Map<number, HTMLElement>()

function cacheAndReturn(pageNumber: number, element: HTMLElement): HTMLElement {
  PAGE_LAYER_CACHE.set(pageNumber, element)
  return element
}

function getPageLayer(pageNumber: number): HTMLElement | null {
  const cached = PAGE_LAYER_CACHE.get(pageNumber)
  if (cached && cached.isConnected) return cached

  const virtualIndex = pageNumber - 1
  const [byVirtualIndex] = pageLayerSelectors(pageNumber)

  const byVirtual = document.querySelector<HTMLElement>(byVirtualIndex)
  if (byVirtual) return cacheAndReturn(pageNumber, byVirtual)

  const allPages = document.querySelectorAll<HTMLElement>(`.${PAGE_LAYER_CLASS}`)
  for (const el of allPages) {
    const vi = el.dataset.virtualIndex
    if (vi && Number(vi) === virtualIndex) {
      return cacheAndReturn(pageNumber, el)
    }
  }

  // Single-page view: whatever page is on screen is the requested page.
  if (allPages.length === 1) {
    return cacheAndReturn(pageNumber, allPages[0])
  }

  return null
}

/**
 * Characters that, when present in a text layer, mark the page as worth a second
 * look: each is unusual in running prose but a real character in some orthography
 * (U+00B8 is the Latin-1 cedilla used in French/Catalan and as a currency symbol,
 * U+02C6 in Sami orthographies, U+02DC in Turkic transliteration).
 *
 * This is only a trigger for the innerText retry below, NOT a known pdf.js
 * corruption detector. Neither pdfjs-dist@3.11.174 nor @react-pdf-viewer@3.12.0
 * contains any ::before/beforeCSS text-layer mechanism -- the spans come straight
 * from getTextContent()'s item.str -- so there is no rendering-time fix-up for
 * this to recover, and nothing here attempts to rewrite the characters.
 */
const SUSPICIOUS_GLYPH_RUN = /[\u00B8\u02C6\u02DC]/

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

  const textLayer = pageLayer.querySelector<HTMLElement>(TEXT_LAYER_SELECTOR)

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

export { collectTextItems, orderTextItems }

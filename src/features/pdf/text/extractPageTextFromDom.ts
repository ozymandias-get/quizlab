/**
 * Extracts text content from a specific PDF page's DOM layer.
 *
 * Selectors are resolved by `./pdfTextLayerSource`, which pairs the native
 * viewer's `data-native-pdf-*` markup with the selector that reads that marker's
 * individual text runs, and reports whether a page carries a text layer at all.
 *
 * The DOM is still the source of truth for *where* the runs are, because that is
 * the geometry PDF.js used to paint the canvas. What changed is what happens
 * after measurement: `./pdfTextPipeline` reconstructs rows, columns, paragraphs,
 * lists and tables instead of joining the runs line by line. The fallback paths
 * below are unchanged, so a page with no usable text layer still reports
 * "nothing found" rather than a half-guessed document.
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
  readTextRunFontSize,
  type TextLayerSource
} from './pdfTextLayerSource'
import { extractStructuredPdfText } from './pdfTextPipeline'
import type { PdfTextItem } from './types'

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
  // The native viewer keeps one page box and only rewrites its page marker on
  // a page turn. A cached box that is still connected can therefore be showing
  // a different page; it is only valid when the marker still names this page.
  if (
    cached &&
    cached.isConnected &&
    cached.getAttribute('data-native-pdf-page') === String(pageNumber)
  ) {
    return cached
  }
  if (cached) PAGE_LAYER_CACHE.delete(pageNumber)

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

/**
 * Collects positioned text items from a pdf.js text layer.
 *
 * Every run is kept exactly once: `role="presentation"` excludes PDF.js's
 * marked-content wrappers on a tagged PDF (see `native/nativePdfDom.ts`), so a
 * word is not counted a second time through a wrapper's union box.
 */
function collectTextItems(
  layer: HTMLElement,
  spanSelector: string,
  pageNumber: number
): PdfTextItem[] {
  const items: PdfTextItem[] = []
  const spans = layer.querySelectorAll<HTMLElement>(spanSelector)
  for (const span of spans) {
    // Keep the run's own leading/trailing spaces: PDF.js often encodes a word
    // gap as a space at the end of the previous run, and trimming it here would
    // make two adjacent words join (`mg` + `/dL` is fine, `hello` + `world` is
    // not). Whitespace-only runs are still skipped.
    const text = span.textContent || ''
    if (!text.trim()) continue
    const rect = span.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    const item: PdfTextItem = {
      text,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      page: pageNumber
    }
    const fontSize = readTextRunFontSize(span)
    if (fontSize !== undefined) item.fontSize = fontSize
    items.push(item)
  }
  return items
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
    // Geometry-aware extraction first: reconstructs reading order, paragraphs,
    // lists and tables instead of the content-stream order PDF.js wrote.
    const items = collectTextItems(source.layer, source.spanSelector, pageNumber)
    if (items.length > 0) {
      const structuredText = extractStructuredPdfText(items, { mode: 'page' })
      // Geometry-backed text is real even when the page is short. Applying the
      // old >5-character threshold here made a one-word note page report
      // "nothing found"; the threshold still guards the text-less fallbacks
      // below, where a page number or a stray glyph is not a document.
      if (structuredText) {
        return normalizePdfText(structuredText)
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

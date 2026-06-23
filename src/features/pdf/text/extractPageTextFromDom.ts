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

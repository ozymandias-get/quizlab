import { useCallback, useRef } from 'react'

interface UsePdfPageTextExtractionOptions {
  currentPage: number
  onTextExtracted?: (text: string) => void
  onNoTextFound?: () => void
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const PAGE_LAYER_CACHE = new Map<string, HTMLElement>()

function getPageLayerKey(pageNumber: number): string {
  return `page:${pageNumber}`
}

function getPageLayer(pageNumber: number): HTMLElement | null {
  const cacheKey = getPageLayerKey(pageNumber)
  const cached = PAGE_LAYER_CACHE.get(cacheKey)
  if (cached && cached.isConnected) return cached

  const virtualIndex = pageNumber - 1

  const byVirtual = document.querySelector(
    `.rpv-core__page-layer[data-virtual-index="${virtualIndex}"]`
  ) as HTMLElement | null

  if (byVirtual) {
    PAGE_LAYER_CACHE.set(cacheKey, byVirtual)
    return byVirtual
  }

  const byAttr = document.querySelector(
    `.rpv-core__page-layer[data-page-number="${pageNumber}"]`
  ) as HTMLElement | null

  if (byAttr) {
    PAGE_LAYER_CACHE.set(cacheKey, byAttr)
    return byAttr
  }

  const allPages = document.querySelectorAll('.rpv-core__page-layer')
  for (const page of allPages) {
    const el = page as HTMLElement
    const vi = el.dataset.virtualIndex
    if (vi && Number(vi) === virtualIndex) {
      PAGE_LAYER_CACHE.set(cacheKey, el)
      return el
    }
  }

  if (allPages.length === 1) {
    const el = allPages[0] as HTMLElement
    PAGE_LAYER_CACHE.set(cacheKey, el)
    return el
  }

  return null
}

function invalidatePageCache(pageNumber: number): void {
  PAGE_LAYER_CACHE.delete(getPageLayerKey(pageNumber))
}

function collectTextFromElement(el: HTMLElement): string {
  const tc = el.textContent?.trim()
  if (tc && tc.length > 5) return tc

  const parts: string[] = []
  const spans = el.querySelectorAll('span')
  const spanLimit = 500
  let spanCount = 0
  spans.forEach((span) => {
    if (spanCount >= spanLimit) return
    spanCount++
    let t = span.textContent?.trim()
    if (!t) {
      const before = window.getComputedStyle(span, '::before').content
      if (
        before &&
        before !== 'none' &&
        before !== 'normal' &&
        before !== '""' &&
        before !== "''"
      ) {
        t = before.replace(/^["']|["']$/g, '').trim()
      }
    }
    if (t) parts.push(t)
  })

  if (parts.length > 0) return parts.join(' ')

  const innerText = el.innerText?.trim()
  return innerText || ''
}

function extractTextFromPageLayer(pageNumber: number): string | null {
  const pageLayer = getPageLayer(pageNumber)
  if (!pageLayer) return null

  const textLayer = pageLayer.querySelector(
    '.rpv-core__text-layer, .rpv-core__text-layer-basic'
  ) as HTMLElement | null

  if (textLayer) {
    const text = collectTextFromElement(textLayer)
    if (text && text.length > 5) return normalizeText(text)
  }

  const text = collectTextFromElement(pageLayer)
  if (text && text.length > 5) return normalizeText(text)

  return null
}

export function usePdfPageTextExtraction({
  currentPage,
  onTextExtracted,
  onNoTextFound
}: UsePdfPageTextExtractionOptions) {
  const onTextExtractedRef = useRef(onTextExtracted)
  const onNoTextFoundRef = useRef(onNoTextFound)

  onTextExtractedRef.current = onTextExtracted
  onNoTextFoundRef.current = onNoTextFound

  const prevPageRef = useRef(currentPage)
  if (prevPageRef.current !== currentPage) {
    invalidatePageCache(prevPageRef.current)
    prevPageRef.current = currentPage
  }

  const extractCurrentPageText = useCallback(() => {
    const extract = () => {
      const text = extractTextFromPageLayer(currentPage)

      if (!text) {
        onNoTextFoundRef.current?.()
        return null
      }

      onTextExtractedRef.current?.(text)
      return text
    }

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(extract, { timeout: 100 })
      return null
    }

    return setTimeout(extract, 0) as unknown as null
  }, [currentPage])

  return {
    extractCurrentPageText
  }
}

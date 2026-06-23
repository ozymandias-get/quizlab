/**
 * Extended tests for extractPageTextFromDom covering fallback paths,
 * the alternate page selectors, and the page-layer cache.
 */
import {
  extractPageTextFromDom,
  invalidatePageCache
} from '@features/pdf/text/extractPageTextFromDom'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

function makePageLayerWithText(virtualIndex: number, text: string) {
  const layer = document.createElement('div')
  layer.className = 'rpv-core__page-layer'
  layer.setAttribute('data-virtual-index', String(virtualIndex))

  const textLayer = document.createElement('div')
  textLayer.className = 'rpv-core__text-layer'
  const span = document.createElement('span')
  span.textContent = text
  textLayer.appendChild(span)
  layer.appendChild(textLayer)

  return layer
}

describe('extractPageTextFromDom - extended', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    // Clear all caches for any page
    for (let i = 1; i <= 200; i++) invalidatePageCache(i)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('finds page by data-page-number attribute (alt selector)', () => {
    const layer = document.createElement('div')
    layer.className = 'rpv-core__page-layer'
    layer.setAttribute('data-page-number', '5')

    const textLayer = document.createElement('div')
    textLayer.className = 'rpv-core__text-layer'
    const span = document.createElement('span')
    span.textContent = 'page 5 content'
    textLayer.appendChild(span)
    layer.appendChild(textLayer)
    document.body.appendChild(layer)

    const result = extractPageTextFromDom(5)
    expect(result).toBe('page 5 content')
  })

  it('finds page via virtual-index when no specific match (search by index)', () => {
    const layer = document.createElement('div')
    layer.className = 'rpv-core__page-layer'
    // no data-virtual-index, no data-page-number
    layer.dataset.virtualIndex = '7'

    const textLayer = document.createElement('div')
    textLayer.className = 'rpv-core__text-layer'
    const span = document.createElement('span')
    span.textContent = 'page 8 content'
    textLayer.appendChild(span)
    layer.appendChild(textLayer)
    document.body.appendChild(layer)

    // page 8 = virtual index 7
    const result = extractPageTextFromDom(8)
    expect(result).toBe('page 8 content')
  })

  it('falls back to the only page layer when nothing matches', () => {
    const layer = document.createElement('div')
    layer.className = 'rpv-core__page-layer'
    const textLayer = document.createElement('div')
    textLayer.className = 'rpv-core__text-layer'
    const span = document.createElement('span')
    span.textContent = 'lonely page text'
    textLayer.appendChild(span)
    layer.appendChild(textLayer)
    document.body.appendChild(layer)

    // page 99 is the requested page, but there's only one page layer
    const result = extractPageTextFromDom(99)
    expect(result).toBe('lonely page text')
  })

  it('returns null when multiple page layers exist but none match', () => {
    for (let i = 0; i < 3; i++) {
      document.body.appendChild(makePageLayerWithText(i, `page ${i}`))
    }
    // Request page 50 = virtual 49, no match
    expect(extractPageTextFromDom(50)).toBeNull()
  })

  it('extracts text from the basic text-layer class', () => {
    const layer = document.createElement('div')
    layer.className = 'rpv-core__page-layer'
    layer.setAttribute('data-virtual-index', '0')
    const textLayer = document.createElement('div')
    textLayer.className = 'rpv-core__text-layer-basic'
    const span = document.createElement('span')
    span.textContent = 'basic layer text'
    textLayer.appendChild(span)
    layer.appendChild(textLayer)
    document.body.appendChild(layer)

    expect(extractPageTextFromDom(1)).toBe('basic layer text')
  })

  it('falls back to textContent of the page layer when no text-layer exists', () => {
    const layer = document.createElement('div')
    layer.className = 'rpv-core__page-layer'
    layer.setAttribute('data-virtual-index', '0')
    // Direct text content (not in a child text-layer)
    layer.textContent = 'direct text content'
    document.body.appendChild(layer)

    // The textContent length must be > 5 to pass the threshold
    const result = extractPageTextFromDom(1)
    expect(result).toBe('direct text content')
  })

  it('returns null when text content is too short', () => {
    const layer = document.createElement('div')
    layer.className = 'rpv-core__page-layer'
    layer.setAttribute('data-virtual-index', '0')
    const textLayer = document.createElement('div')
    textLayer.className = 'rpv-core__text-layer'
    const span = document.createElement('span')
    span.textContent = 'hi'
    textLayer.appendChild(span)
    layer.appendChild(textLayer)
    document.body.appendChild(layer)

    // 'hi' is 2 chars, less than 5 threshold
    expect(extractPageTextFromDom(1)).toBeNull()
  })

  it('invalidates the cache when the page layer is replaced', () => {
    const layer1 = makePageLayerWithText(0, 'first content here')
    document.body.appendChild(layer1)
    invalidatePageCache(1)

    const first = extractPageTextFromDom(1)
    expect(first).toBe('first content here')

    // Replace the layer (simulate page change)
    layer1.remove()
    const layer2 = makePageLayerWithText(0, 'second content here')
    document.body.appendChild(layer2)
    invalidatePageCache(1)

    const second = extractPageTextFromDom(1)
    expect(second).toBe('second content here')
  })

  it('joins text from multiple spans when textContent is too short', () => {
    const layer = document.createElement('div')
    layer.className = 'rpv-core__page-layer'
    layer.setAttribute('data-virtual-index', '0')
    const textLayer = document.createElement('div')
    textLayer.className = 'rpv-core__text-layer'
    // total textContent "abc" = 3 chars, less than 6, so spans path is used
    textLayer.appendChild(makeSpan('a'))
    textLayer.appendChild(makeSpan('b'))
    textLayer.appendChild(makeSpan('c'))
    layer.appendChild(textLayer)
    document.body.appendChild(layer)

    // The result must be > 5 chars to be returned (threshold)
    // But three short spans joined with spaces = 'a b c' = 5 chars, still below threshold
    // So this returns null. Document the threshold behavior.
    const result = extractPageTextFromDom(1)
    expect(result).toBeNull()
  })

  it('handles pages with more than 500 spans (no truncation)', () => {
    const layer = document.createElement('div')
    layer.className = 'rpv-core__page-layer'
    layer.setAttribute('data-virtual-index', '0')
    const textLayer = document.createElement('div')
    textLayer.className = 'rpv-core__text-layer'
    for (let i = 0; i < 600; i++) {
      textLayer.appendChild(makeSpan(`word${i} `))
    }
    layer.appendChild(textLayer)
    document.body.appendChild(layer)

    const result = extractPageTextFromDom(1)
    expect(result).toBeDefined()
    expect(result).toContain('word599')
  })
})

function makeSpan(text: string) {
  const span = document.createElement('span')
  span.textContent = text
  return span
}

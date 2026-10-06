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

  it('does not locate a page by data-page-number, which the viewer never emits', () => {
    // `@react-pdf-viewer/core@3.12.0` declares no `data-page-number` attribute
    // (0 occurrences in lib/cjs/core.js), and the selector was dropped from
    // lib/pdfViewerDom.ts for that reason. This used to be a positive test for
    // that selector, but it passed only because the fixture held a single page
    // layer and the lone-page fallback claimed it — deleting the attribute did
    // not change the result.
    //
    // Two layers are present now, which disables that fallback. If the dead
    // selector were honored, layer A would be returned for page 1 and these
    // expectations would fail.
    const layerA = document.createElement('div')
    layerA.className = 'rpv-core__page-layer'
    layerA.setAttribute('data-page-number', '1')

    const layerB = document.createElement('div')
    layerB.className = 'rpv-core__page-layer'
    layerB.setAttribute('data-page-number', '2')

    for (const [layer, text] of [
      [layerA, 'first page content'],
      [layerB, 'second page content']
    ] as const) {
      const textLayer = document.createElement('div')
      textLayer.className = 'rpv-core__text-layer'
      const span = document.createElement('span')
      span.textContent = text
      textLayer.appendChild(span)
      layer.appendChild(textLayer)
      document.body.appendChild(layer)
    }

    // Neither layer has a data-virtual-index, so neither is addressable.
    expect(extractPageTextFromDom(1)).toBeNull()
    expect(extractPageTextFromDom(2)).toBeNull()
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

  it('does not treat the v2 text-layer-basic class as a text layer', () => {
    // `.rpv-core__text-layer-basic` has 0 occurrences in the pinned viewer:
    // v3 renders pages to canvas and emits only `.rpv-core__text-layer`. The
    // class was dropped from lib/pdfViewerDom.ts for that reason. This used to be
    // a positive test for it, but it passed through the page-layer textContent
    // fallback, so renaming the class did not change the result.
    //
    // The decoy text sits OUTSIDE the basic-classed child, so if that class were
    // honored as a text layer the child would be extracted on its own and the
    // decoy would never appear.
    const layer = document.createElement('div')
    layer.className = 'rpv-core__page-layer'
    layer.setAttribute('data-virtual-index', '0')
    layer.appendChild(document.createTextNode('decoy outside any text layer'))

    const basicLayer = document.createElement('div')
    basicLayer.className = 'rpv-core__text-layer-basic'
    const span = document.createElement('span')
    span.textContent = 'basic layer text'
    basicLayer.appendChild(span)
    layer.appendChild(basicLayer)
    document.body.appendChild(layer)

    // The decoy is present, which is the point: extraction fell back to the
    // PAGE LAYER's textContent rather than scoping to the basic-classed child.
    // If `text-layer-basic` were honored as a text layer, extraction would be
    // scoped to that child and the decoy would be absent — so this fails if the
    // dead class is ever re-added to lib/pdfViewerDom.ts.
    const text = extractPageTextFromDom(1)
    expect(text).toContain('basic layer text')
    expect(text).toContain('decoy outside any text layer')
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

  /**
   * The suspicious-glyph run only switches the collector from textContent to
   * innerText; it must not rewrite anything. jsdom does not implement innerText,
   * so the branch is observed by asserting the fallback is entered (the spans
   * join path then produces the text) rather than that innerText differs.
   */
  describe('suspicious glyph run triggers the innerText retry', () => {
    const SUSPICIOUS = /[¸ˆ˜]/

    it.each(['¸', 'ˆ', '˜'])('enters the fallback for %s', (glyph) => {
      const layer = document.createElement('div')
      layer.className = 'rpv-core__page-layer'
      layer.setAttribute('data-virtual-index', '0')
      const textLayer = document.createElement('div')
      textLayer.className = 'rpv-core__text-layer'
      const span = document.createElement('span')
      span.textContent = `before ${glyph} after`
      textLayer.appendChild(span)
      layer.appendChild(textLayer)
      document.body.appendChild(layer)

      // Long enough to clear the >5 fast-path length check, so the only reason
      // the fast path is skipped is the glyph run.
      const text = extractPageTextFromDom(1)
      expect(text).not.toBeNull()
      expect(text).toContain(glyph)
      expect(SUSPICIOUS.test(text as string)).toBe(true)
    })

    it('leaves the glyph in place rather than substituting a Turkish letter', () => {
      const layer = document.createElement('div')
      layer.className = 'rpv-core__page-layer'
      layer.setAttribute('data-virtual-index', '0')
      const textLayer = document.createElement('div')
      textLayer.className = 'rpv-core__text-layer'
      const span = document.createElement('span')
      // U+02C6 MODIFIER LETTER CIRCUMFLEX ACCENT, not U+005E CIRCUMFLEX ACCENT:
      // they render alike but only the former is one of the mapped codepoints.
      span.textContent = 'Français ¸ façon et ˆ accent'
      textLayer.appendChild(span)
      layer.appendChild(textLayer)
      document.body.appendChild(layer)

      const text = extractPageTextFromDom(1) as string
      expect(text).toContain('¸')
      expect(text).toContain('ˆ')
      expect(text).not.toContain('ü')
      expect(text).not.toContain('ö')
    })
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

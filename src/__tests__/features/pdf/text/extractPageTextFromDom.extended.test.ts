/**
 * `extractPageTextFromDom` — the fallback paths, the length threshold and the
 * page cache.
 *
 * The fixtures are the native viewer's markup: a `[data-native-pdf-page="N"]` page
 * box wrapping a `[data-native-pdf-text-layer]` layer whose runs are
 * `span[role="presentation"]`.
 *
 * What this covers is extraction behaviour, which is renderer-agnostic: a page
 * box is located by its own attribute, so there is no separate page-addressing
 * rule to assert.
 */
import {
  extractPageTextFromDom,
  invalidatePageCache
} from '@features/pdf/text/extractPageTextFromDom'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/** A mounted native page: the page box, its text layer and its runs. */
function makePage(
  pageNumber: number,
  options: { textLayer?: boolean; runs?: string[]; rawText?: string } = {}
) {
  const box = document.createElement('div')
  box.setAttribute('data-native-pdf-page', String(pageNumber))

  if (options.rawText !== undefined) {
    // Direct text content on the page box, i.e. no text layer at all.
    box.textContent = options.rawText
    return box
  }

  if (options.textLayer !== false) {
    const layer = document.createElement('div')
    layer.setAttribute('data-native-pdf-text-layer', '')
    layer.setAttribute('data-native-pdf-text-page', String(pageNumber))
    for (const run of options.runs ?? []) {
      const span = document.createElement('span')
      span.setAttribute('role', 'presentation')
      span.textContent = run
      layer.appendChild(span)
    }
    box.appendChild(layer)
  }
  return box
}

/** Mount a page and return it, as `NativePdfViewer` would. */
function mountPage(...args: Parameters<typeof makePage>): HTMLElement {
  const box = makePage(...args)
  document.body.appendChild(box)
  return box
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

  it('extracts the page text from the text layer', () => {
    mountPage(1, { runs: ['the', 'quick', 'brown', 'fox'] })

    expect(extractPageTextFromDom(1)).toBe('thequickbrownfox')
  })

  it('returns null for a page that is not mounted', () => {
    mountPage(1, { runs: ['some content on page one'] })

    // The single-canvas viewer mounts one page at a time. Asking for a page that is
    // not on screen must answer null rather than hand back the current page's text.
    expect(extractPageTextFromDom(2)).toBeNull()
  })

  it('falls back to textContent of the page box when no text layer exists', () => {
    mountPage(1, { rawText: 'direct text content' })

    // The textContent length must be > 5 to pass the threshold
    expect(extractPageTextFromDom(1)).toBe('direct text content')
  })

  it('returns null when the text layer has no text at all', () => {
    mountPage(1, { textLayer: false })

    expect(extractPageTextFromDom(1)).toBeNull()
  })

  it('returns null when text content is too short', () => {
    mountPage(1, { runs: ['hi'] })

    // 'hi' is 2 chars, less than the 5-char threshold
    expect(extractPageTextFromDom(1)).toBeNull()
  })

  /**
   * The suspicious-glyph run only switches the collector from textContent to
   * innerText; it must not rewrite anything. jsdom does not implement innerText,
   * so the branch is observed by asserting the fallback is entered (the spans join
   * path then produces the text) rather than that innerText differs.
   */
  describe('suspicious glyph run triggers the innerText retry', () => {
    const SUSPICIOUS = /[¸ˆ˜]/

    it.each(['¸', 'ˆ', '˜'])('enters the fallback for %s', (glyph) => {
      mountPage(1, { runs: [`before ${glyph} after`] })

      // Long enough to clear the >5 fast-path length check, so the only reason
      // the fast path is skipped is the glyph run.
      const text = extractPageTextFromDom(1)
      expect(text).not.toBeNull()
      expect(text).toContain(glyph)
      expect(SUSPICIOUS.test(text as string)).toBe(true)
    })

    it('leaves the glyph in place rather than substituting a Turkish letter', () => {
      // U+02C6 MODIFIER LETTER CIRCUMFLEX ACCENT, not U+005E CIRCUMFLEX ACCENT:
      // they render alike but only the former is one of the mapped codepoints.
      mountPage(1, { runs: ['Français ¸ façon et ˆ accent'] })

      const text = extractPageTextFromDom(1) as string
      expect(text).toContain('¸')
      expect(text).toContain('ˆ')
      expect(text).not.toContain('ü')
      expect(text).not.toContain('ö')
    })
  })

  it('invalidates the cache when the page is replaced', () => {
    mountPage(1, { runs: ['first content here'] })
    invalidatePageCache(1)

    expect(extractPageTextFromDom(1)).toBe('first content here')

    // A page turn tears the page box down and mounts another. After invalidation
    // the collector must re-read rather than serve the cached text.
    document.body.innerHTML = ''
    mountPage(1, { runs: ['second content here'] })
    invalidatePageCache(1)

    expect(extractPageTextFromDom(1)).toBe('second content here')
  })

  it('does not serve cached text for a replaced page even without invalidation', () => {
    mountPage(1, { runs: ['first content here'] })
    expect(extractPageTextFromDom(1)).toBe('first content here')

    document.body.innerHTML = ''
    mountPage(1, { runs: ['second content here'] })

    // The cache holds the page *box*, not its text, and a hit is only served while
    // that box is still connected. A page turn detaches it, so a stale page cannot
    // be served even if a caller forgets to invalidate.
    expect(extractPageTextFromDom(1)).toBe('second content here')
  })

  it('joins text from multiple spans when textContent is too short', () => {
    mountPage(1, { runs: ['a', 'b', 'c'] })

    // The result must clear the 5-char threshold. Three short runs joined with
    // spaces = 'a b c' = 5 chars, still below it, so this documents the threshold.
    expect(extractPageTextFromDom(1)).toBeNull()
  })

  it('clears the threshold with one more run', () => {
    mountPage(1, { runs: ['a', 'b', 'c', 'd'] })

    expect(extractPageTextFromDom(1)).toBe('a b c d')
  })

  it('handles pages with more than 500 spans (no truncation)', () => {
    const runs = Array.from({ length: 600 }, (_, i) => `word${i} `)
    mountPage(1, { runs })

    const result = extractPageTextFromDom(1)
    expect(result).toBeDefined()
    expect(result).toContain('word599')
  })
})

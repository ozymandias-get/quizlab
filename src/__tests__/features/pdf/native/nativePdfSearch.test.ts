/**
 * The native search core: what matches, where the rectangle is, and what is drawn.
 *
 * Everything here is production code — `nativePdfSearch.ts` — driven against a text
 * layer built the way PDF.js builds one (`span[role="presentation"]`, one text node per
 * run) inside a page box the way `NativePdfViewer` builds it. Only layout is faked, by
 * `nativeSearchGeometry`, because jsdom has none; see that file for what that does and
 * does not prove.
 *
 * The behaviours pinned are the ones carried over from `@react-pdf-viewer/search`, which
 * is what the legacy path actually runs (it never reaches for `PDFFindController`):
 *
 *  - literal, case-insensitive matching; a keyword is never a pattern
 *  - runs are concatenated with no separator, so a match spans runs and line breaks
 *  - one rectangle per run a match touches, never a rectangle over the whole match
 *  - the gap between two runs draws nothing
 *  - geometry is measured with a `Range` and made page-relative, never estimated
 *  - the highlight DOM is QuizLab's, with the legacy fade-in and reduced-motion
 *    semantics preserved
 */
import {
  collectNativePdfSearchPageText,
  findNativePdfSearchHighlights,
  findNativePdfSearchMatches,
  renderNativePdfSearchHighlights,
  resolveNativePdfSearchHighlights
} from '@features/pdf/native/nativePdfSearch'

import { beforeEach, afterEach, describe, expect, it } from 'vitest'

import {
  type NativeSearchGeometryHandle,
  highlightsIn,
  installNativeSearchGeometry
} from './nativeSearchGeometry'

interface NativePage {
  pageBox: HTMLElement
  textLayer: HTMLElement
  searchLayer: HTMLElement
}

/**
 * A native page box with a text layer holding one span per run.
 *
 * `runs` are the strings PDF.js would have written for the page's text items, in
 * content order — which is also the order the search concatenates them in.
 */
function buildPage(runs: string[]): NativePage {
  const pageBox = document.createElement('div')
  pageBox.setAttribute('data-native-pdf-page', '1')
  const textLayer = document.createElement('div')
  textLayer.setAttribute('data-native-pdf-text-layer', '')
  textLayer.setAttribute('data-native-pdf-text-page', '1')
  for (const run of runs) {
    const span = document.createElement('span')
    span.setAttribute('role', 'presentation')
    span.textContent = run
    textLayer.append(span)
  }
  const searchLayer = document.createElement('div')
  searchLayer.setAttribute('data-native-pdf-search-layer', '')
  pageBox.append(textLayer, searchLayer)
  document.body.append(pageBox)
  return { pageBox, textLayer, searchLayer }
}

let geometry: NativeSearchGeometryHandle

beforeEach(() => {
  document.body.replaceChildren()
  geometry = installNativeSearchGeometry()
})

afterEach(() => {
  geometry.restore()
})

describe('collecting the page text', () => {
  it('concatenates the runs in DOM order, with no separator', () => {
    const { textLayer } = buildPage(['Systemic ', 'lupus'])

    expect(collectNativePdfSearchPageText(textLayer).text).toBe('Systemic lupus')
  })

  it('reads the run the text layer actually measures, not the whole span', () => {
    const { textLayer } = buildPage(['lupus'])
    const span = textLayer.querySelector('span') as HTMLElement
    // PDF.js nests runs inside `markedContent` wrappers on a tagged PDF. A span that is
    // only a wrapper carries no text node of its own, so it must contribute nothing —
    // otherwise every word would be counted twice and matched at an offset that cannot
    // be measured.
    const wrapper = document.createElement('span')
    wrapper.className = 'markedContent'
    const inner = document.createElement('span')
    inner.setAttribute('role', 'presentation')
    inner.textContent = 'nested'
    wrapper.append(inner)
    textLayer.append(wrapper, span)

    const pageText = collectNativePdfSearchPageText(textLayer)

    expect(pageText.text).toBe('nestedlupus')
    // One run per measurable text node, not one per span.
    expect(pageText.runs).toHaveLength(2)
  })

  it('ignores an empty run rather than offsetting the ones after it', () => {
    const { textLayer } = buildPage(['', 'lupus', ''])

    expect(collectNativePdfSearchPageText(textLayer).text).toBe('lupus')
  })

  it('is empty for a page with no text at all', () => {
    const { textLayer } = buildPage([])

    expect(collectNativePdfSearchPageText(textLayer)).toEqual({ text: '', runs: [] })
  })
})

describe('matching', () => {
  function matchesFor(runs: string[], keyword: string) {
    const { textLayer } = buildPage(runs)
    return findNativePdfSearchMatches(collectNativePdfSearchPageText(textLayer), keyword, 1)
  }

  it('finds a single match and reports it against the page text', () => {
    const { textLayer } = buildPage(['anti-phospholipid syndrome'])

    const matches = findNativePdfSearchMatches(
      collectNativePdfSearchPageText(textLayer),
      'phospholipid',
      3
    )

    expect(matches).toEqual([{ pageNumber: 3, start: 5, end: 17, keyword: 'phospholipid' }])
  })

  it('finds every match, in order, without overlapping them', () => {
    const matches = matchesFor(['lupus and lupus again and lupus'], 'lupus')

    expect(matches.map((match) => match.start)).toEqual([0, 10, 26])
    expect(matches.every((match) => match.end - match.start === 5)).toBe(true)
  })

  it('ignores case on both sides of the comparison', () => {
    const matches = matchesFor(['SJOGREN syndrome, Sjogren syndrome'], 'sjogren')

    expect(matches).toHaveLength(2)
    expect(matchesFor(['RA Method'], 'ra method')).toHaveLength(1)
    expect(matchesFor(['RA Method'], 'ra method'.toUpperCase())).toHaveLength(1)
  })

  it('matches across a run boundary, which is what makes a split keyword work', () => {
    // "romatoid artrit" written as two runs of one phrase.
    const matches = matchesFor(['romatoid', ' artrit'], 'romatoid artrit')

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ start: 0, end: 15 })
  })

  it('matches across a line break, which is one case of the same thing', () => {
    // "systemic" and "lupus" on separate lines: PDF.js ends a line with a `<br>`, which
    // contributes no characters, so the two runs still concatenate into one phrase.
    const matches = matchesFor(['systemic ', 'lupus'], 'systemic lupus')

    expect(matches).toHaveLength(1)
  })

  it('does not join two runs that have no space between them', () => {
    // Guards the flip side of concatenation: "lupus" + "nephritis" is one word to the
    // matcher, so a phrase search must not silently find it.
    expect(matchesFor(['lupus', 'nephritis'], 'lupus nephritis')).toHaveLength(0)
  })

  it('treats the keyword literally rather than as a pattern', () => {
    expect(matchesFor(['a.c and abc'], 'a.c')).toHaveLength(1)
    // A regex would match "abc" here, and would also blow up on an unbalanced group.
    expect(matchesFor(['abc'], 'a.c')).toHaveLength(0)
    expect(matchesFor(['a(b'], 'a(b')).toHaveLength(1)
    expect(matchesFor(['anything'], '(unclosed')).toHaveLength(0)
  })

  it('keeps offsets on the original string when a character case-folds to two units', () => {
    // 'İ' (U+0130) lowercases to 'i' + a combining dot. A matcher that folded the whole
    // page string would shift every offset after it onto the wrong glyph.
    const matches = matchesFor(['İstanbul lupus'], 'lupus')

    expect(matches).toHaveLength(1)
    expect('İstanbul lupus'.slice(matches[0].start, matches[0].end)).toBe('lupus')
  })

  it('does not search for a whitespace-only keyword', () => {
    expect(matchesFor(['lupus'], '   ')).toEqual([])
    expect(matchesFor(['lupus'], '')).toEqual([])
    expect(matchesFor(['lupus'], '\t\n')).toEqual([])
  })

  it('finds nothing on a page with no text', () => {
    expect(matchesFor([], 'lupus')).toEqual([])
  })
})

describe('geometry', () => {
  it('turns a match into a page-relative rectangle measured from the run', () => {
    const run = 'anti-phospholipid syndrome'
    const { pageBox, textLayer } = buildPage([run])
    geometry.attachPageBox(pageBox)
    const pageText = collectNativePdfSearchPageText(textLayer)

    const { matches } = findNativePdfSearchHighlights({
      keyword: 'lupus',
      pageNumber: 1,
      pageBox,
      textLayer
    })
    expect(matches).toEqual([])

    const [highlight] = resolveNativePdfSearchHighlights(
      findNativePdfSearchMatches(pageText, 'phospho', 1),
      pageText,
      pageBox
    )
    // Run 0's box is left 20, width 80 at scale 1; "phospho" is characters 5…12 of 24.
    expect(highlight.rect.left).toBeCloseTo(20 + (80 * 5) / run.length, 6)
    expect(highlight.rect.width).toBeCloseTo((80 * 7) / run.length, 6)
    expect(highlight.rect.top).toBe(30)
    expect(highlight.rect.height).toBe(12)
  })

  it('makes geometry page-relative, so where the page sits on screen changes nothing', () => {
    const atOrigin = installNativeSearchGeometry()
    const first = buildPage(['lupus'])
    atOrigin.attachPageBox(first.pageBox)
    const firstRect = findNativePdfSearchHighlights({
      keyword: 'lupus',
      pageNumber: 1,
      pageBox: first.pageBox,
      textLayer: first.textLayer
    }).highlights
    atOrigin.restore()

    // The same page, scrolled to a different point in the document.
    const scrolled = installNativeSearchGeometry({ pageOrigin: { left: 137, top: 42 } })
    const second = buildPage(['lupus'])
    scrolled.attachPageBox(second.pageBox)
    const secondRect = findNativePdfSearchHighlights({
      keyword: 'lupus',
      pageNumber: 1,
      pageBox: second.pageBox,
      textLayer: second.textLayer
    }).highlights
    scrolled.restore()

    expect(firstRect).toEqual(secondRect)
    expect(firstRect[0].rect.left).toBe(20)
  })

  it('draws one rectangle per run a match touches, and never over the whole match', () => {
    const { pageBox, textLayer } = buildPage(['romatoid', ' artrit'])
    geometry.attachPageBox(pageBox)

    const { matches, highlights } = findNativePdfSearchHighlights({
      keyword: 'romatoid artrit',
      pageNumber: 1,
      pageBox,
      textLayer
    })

    expect(matches).toHaveLength(1)
    // Two runs touched → two rectangles, both carrying the same match index.
    expect(highlights).toHaveLength(2)
    expect(highlights.map((highlight) => highlight.matchIndex)).toEqual([0, 0])
    // Run 0 and run 1 sit on the same row, so the two boxes are side by side.
    expect(highlights[0].rect.left).toBeLessThan(highlights[1].rect.left)
  })

  it('draws one rectangle per line when a match spans a line break', () => {
    // Two runs on separate rows: run 0 on row 0, run 1 on row 1 (runsPerRow is 1 here).
    geometry.restore()
    geometry = installNativeSearchGeometry({ runsPerRow: 1 })
    const { pageBox, textLayer } = buildPage(['systemic ', 'lupus'])
    geometry.attachPageBox(pageBox)

    const { highlights } = findNativePdfSearchHighlights({
      keyword: 'systemic lupus',
      pageNumber: 1,
      pageBox,
      textLayer
    })

    expect(highlights).toHaveLength(2)
    expect(highlights[0].rect.top).toBeLessThan(highlights[1].rect.top)
  })

  it('draws nothing for the gap run between two matched words', () => {
    // The middle run is a single space: the gap between two words the matcher bridged.
    // The legacy renderer draws no rectangle for it, and neither may this — a box over
    // blank space would be visible on every multi-run match.
    const { pageBox, textLayer } = buildPage(['lupus', ' ', 'nephritis'])
    geometry.attachPageBox(pageBox)

    const { matches, highlights } = findNativePdfSearchHighlights({
      keyword: 'lupus nephritis',
      pageNumber: 1,
      pageBox,
      textLayer
    })

    expect(matches).toHaveLength(1)
    expect(highlights).toHaveLength(2)
    expect(highlights.map((highlight) => highlight.matchIndex)).toEqual([0, 0])
    // Runs 0 and 2, in that order and nothing in between.
    expect(highlights[0].rect.left).toBe(20)
    expect(highlights[1].rect.left).toBe(200)
  })

  it('produces one rectangle per client rect when a run reports several boxes', () => {
    // A run whose box is split — a rotated or wrapped run — reports more than one client
    // rect for a single range, and each becomes its own highlight while keeping the
    // logical match's index.
    geometry.restore()
    geometry = installNativeSearchGeometry({
      rangeRects: (_range, box) =>
        box
          ? [
              { left: box.left, top: box.top, width: box.width / 2, height: box.height },
              {
                left: box.left + box.width / 2,
                top: box.top + box.height,
                width: box.width / 2,
                height: box.height
              }
            ]
          : []
    })
    const { pageBox, textLayer } = buildPage(['lupus'])
    geometry.attachPageBox(pageBox)

    const { highlights } = findNativePdfSearchHighlights({
      keyword: 'lupus',
      pageNumber: 1,
      pageBox,
      textLayer
    })

    expect(highlights).toHaveLength(2)
    expect(highlights.map((highlight) => highlight.matchIndex)).toEqual([0, 0])
  })

  it('orders rectangles by position, top then left', () => {
    // One range reporting its boxes out of order: the overlay has to be sorted by
    // position, because DOM order is content order and the two are not the same thing.
    geometry.restore()
    geometry = installNativeSearchGeometry({
      rangeRects: () => [
        { left: 20, top: 300, width: 40, height: 12 },
        { left: 60, top: 100, width: 40, height: 12 }
      ]
    })
    const { pageBox, textLayer } = buildPage(['lupus'])
    geometry.attachPageBox(pageBox)

    const { highlights } = findNativePdfSearchHighlights({
      keyword: 'lupus',
      pageNumber: 1,
      pageBox,
      textLayer
    })

    expect(highlights.map((highlight) => highlight.rect.top)).toEqual([100, 300])
  })

  it('refuses a rectangle that is not finite or has no area', () => {
    geometry.restore()
    geometry = installNativeSearchGeometry({
      rangeRects: () => [
        { left: Number.NaN, top: 10, width: 40, height: 12 },
        { left: 10, top: 10, width: Number.POSITIVE_INFINITY, height: 12 },
        { left: 10, top: 10, width: 0, height: 12 },
        { left: 10, top: 10, width: 40, height: 0 },
        { left: 10, top: 10, width: 40, height: 12 }
      ]
    })
    const { pageBox, textLayer } = buildPage(['lupus'])
    geometry.attachPageBox(pageBox)

    const { highlights } = findNativePdfSearchHighlights({
      keyword: 'lupus',
      pageNumber: 1,
      pageBox,
      textLayer
    })

    expect(highlights).toEqual([
      { matchIndex: 0, rect: { top: 10, left: 10, width: 40, height: 12 } }
    ])
  })

  it('draws nothing when the host cannot measure a range', () => {
    geometry.restore()
    const { pageBox, textLayer } = buildPage(['lupus'])
    geometry.attachPageBox(pageBox)

    const { matches, highlights } = findNativePdfSearchHighlights({
      keyword: 'lupus',
      pageNumber: 1,
      pageBox,
      textLayer
    })

    // The match exists; with no geometry there is nothing to put on screen, and the code
    // must not invent a rectangle.
    expect(matches).toHaveLength(1)
    expect(highlights).toEqual([])
  })

  it('has nothing to resolve without a match', () => {
    const { pageBox, textLayer } = buildPage(['lupus'])
    geometry.attachPageBox(pageBox)

    expect(
      resolveNativePdfSearchHighlights([], collectNativePdfSearchPageText(textLayer), pageBox)
    ).toEqual([])
  })
})

describe('drawing the highlights', () => {
  function draw(runs: string[], keyword: string, reducedMotion = false): HTMLElement {
    const { pageBox, searchLayer, textLayer } = buildPage(runs)
    geometry.attachPageBox(pageBox)
    const { highlights } = findNativePdfSearchHighlights({
      keyword,
      pageNumber: 1,
      pageBox,
      textLayer
    })
    renderNativePdfSearchHighlights(searchLayer, highlights, { keyword, reducedMotion })
    return searchLayer
  }

  it('writes one element per rectangle with its own index and match index', () => {
    const layer = draw(['lupus and lupus'], 'lupus')
    const highlights = highlightsIn(layer)

    expect(highlights).toHaveLength(2)
    expect(highlights.map((element) => element.dataset.nativePdfSearchIndex)).toEqual(['0', '1'])
    expect(highlights.map((element) => element.dataset.nativePdfSearchMatch)).toEqual(['0', '1'])
  })

  it('positions each element from its measured rectangle, in page pixels', () => {
    const layer = draw(['lupus and lupus'], 'lupus')
    const [first, second] = highlightsIn(layer)

    expect(first.style.left).toMatch(/px$/)
    expect(first.style.top).toBe('30px')
    expect(Number.parseFloat(first.style.width)).toBeCloseTo((80 * 5) / 15, 6)
    // The second occurrence is on the same row, further right.
    expect(Number.parseFloat(second.style.left)).toBeGreaterThan(
      Number.parseFloat(first.style.left)
    )
  })

  it('uses QuizLab attributes, never the legacy plugin class', () => {
    const layer = draw(['lupus'], 'lupus')

    expect(layer.querySelectorAll('[data-native-pdf-search-highlight]')).toHaveLength(1)
    expect(layer.querySelectorAll('.rpv-search__highlight')).toHaveLength(0)
    expect(layer.querySelector('[class]')).toBe(null)
  })

  it('titles each highlight with the keyword, trimmed', () => {
    const { searchLayer } = buildPage([])
    renderNativePdfSearchHighlights(
      searchLayer,
      [{ matchIndex: 0, rect: { top: 0, left: 0, width: 10, height: 10 } }],
      { keyword: '  lupus  ', reducedMotion: false }
    )

    expect(highlightsIn(searchLayer)[0].getAttribute('title')).toBe('lupus')
  })

  it('matches a padded keyword literally, as the legacy path does', () => {
    // `PdfToolbar` passes the raw input, so a keyword with a stray space is searched as
    // typed. The legacy plugin escapes and matches it verbatim too, so this is parity
    // rather than a native peculiarity — and it is why the `title` is trimmed separately.
    expect(highlightsIn(draw(['lupus'], '  lupus  '))).toHaveLength(0)
  })

  it('defers the fade-in so highlights do not compete with rasterization', () => {
    const [highlight] = highlightsIn(draw(['lupus'], 'lupus'))

    expect(highlight.style.opacity).toBe('0')
    expect(highlight.style.animation).toContain('pdf-highlight-fadein')
    expect(highlight.style.animation).toContain('var(--duration-normal)')
    expect(highlight.style.animation).toContain('var(--duration-deliberate)')
    expect(highlight.style.animation).toContain('forwards')
  })

  it('shows a static dimmed highlight under reduced motion', () => {
    const [highlight] = highlightsIn(draw(['lupus'], 'lupus', true))

    expect(highlight.style.opacity).toBe('0.3')
    expect(highlight.style.animation).toBe('')
  })

  it('keeps the geometry under either motion mode', () => {
    for (const reducedMotion of [false, true]) {
      const [highlight] = highlightsIn(draw(['lupus'], 'lupus', reducedMotion))
      expect(highlight.style.left).not.toBe('')
      expect(highlight.style.height).toBe('12px')
    }
  })

  it('replaces whatever was in the layer, so a stale rectangle cannot survive', () => {
    const layer = draw(['lupus'], 'lupus')
    expect(highlightsIn(layer)).toHaveLength(1)

    renderNativePdfSearchHighlights(layer, [], { keyword: 'lupus', reducedMotion: false })

    expect(highlightsIn(layer)).toHaveLength(0)
    // The overlay element itself survives: its identity is the contract.
    expect(layer.hasAttribute('data-native-pdf-search-layer')).toBe(true)
  })

  it('leaves the overlay empty when there is no match', () => {
    expect(highlightsIn(draw(['lupus'], 'sjogren'))).toHaveLength(0)
  })
})

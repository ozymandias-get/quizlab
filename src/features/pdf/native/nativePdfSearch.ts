/**
 * Native PDF search: literal matching over the current page's text layer, and the
 * rectangles each match occupies.
 *
 * ## Why this is not `PDFFindController`
 *
 * `PDFFindController` exists in `pdfjs-dist` — in `web/pdf_viewer.mjs`, and not in the
 * package's entry point. Its constructor demands an `EventBus` (`eventBus.on(...)` is
 * called immediately, four times), a `linkService` and a whole-document search over
 * pages it discovers through `PDFPageView`; it publishes matches by dispatching
 * `updatetextlayermatches` for a viewer to route back into page views. So it needs the
 * web viewer: page views, history, sidebar, thumbnails, the scripting manager. This
 * viewer is single-page and owns its own lifecycle, exactly as Phase 6 found when it
 * declined `PDFLinkService` for the same module. Importing it would put 320 kB of
 * unused viewer into the renderer for a find bar this app does not render.
 *
 * **The legacy path does not use it either.** `@react-pdf-viewer/search` never reaches
 * for `PDFFindController`; its `Highlights` component walks the *DOM* text layer,
 * concatenates the runs, scans with one escaped case-insensitive regexp and measures
 * each match with `document.createRange()`. So that DOM algorithm — not the controller
 * — is the behaviour this module ports. `AGENT_HANDOFF.md` records the same conclusion.
 *
 * ## What was carried over, deliberately
 *
 * - **Scope: the rendered page.** The legacy viewer runs `ViewMode.SinglePage`, so the
 *   plugin's per-page `highlightAll` only ever sees the current page, and the stored
 *   keyword makes it recompute when the next page's text layer renders. Same here: one
 *   page, query kept across page changes, geometry redrawn from the new page's runs.
 * - **Literal, case-insensitive.** The plugin escapes the keyword and matches it with
 *   `gi`. Here it is scanned directly, so a keyword is never a pattern — no regex
 *   injection surface and no escaping to get wrong.
 * - **Runs are concatenated with no separator**, which is what makes a match span two
 *   text runs, two words in two runs, or two lines. The classic cases — a keyword split
 *   across a style change, or across a line break — fall out of that rather than being
 *   special-cased.
 * - **One rectangle per run, not one per match.** A match that crosses a run boundary
 *   is highlighted once per run it touches, exactly as the plugin's per-span grouping
 *   does, so a rectangle never covers text the keyword did not match.
 * - **A run covered by a single space draws nothing.** That run is the gap between two
 *   words or two lines; the plugin skips it and so does this.
 * - **Reading order of the overlay**: top, then left.
 *
 * ## Why offsets are never taken from a case-folded copy of the page
 *
 * Matching has to be case-insensitive, but `String#toLowerCase()` is not
 * length-preserving for every character — `'İ'` (U+0130) folds to two code units. A
 * lowercased copy of the page would therefore shift every offset after such a
 * character, and the geometry would land on the wrong glyph. So the comparison folds
 * one code unit at a time and every offset stays an index into the original string,
 * which is also what a `Range` takes.
 *
 * Deliberately *not* reproduced: the `gi` regexp's Unicode canonicalization, where
 * `/s/i` also matches `'ſ'`. Locale-independent per-character folding is the more
 * predictable of the two, and a locale-aware fold (`toLocaleLowerCase`) would make the
 * same document match differently depending on the user's locale.
 *
 * ## Geometry
 *
 * A rectangle comes from `Range.getClientRects()` — never from an estimated character
 * width — and is then made page-relative by subtracting the page box's own rect:
 *
 * ```
 * left = rect.left - pageBox.left
 * top  = rect.top  - pageBox.top
 * ```
 *
 * The page box is the canvas's box, so this is the same coordinate space the canvas
 * painted in: correct at every scale and on every rotation, because the rotation is
 * already folded into the rendered spans and the canvas alike. Nothing is scaled here,
 * and no window or container scroll offset is applied — the overlay is positioned
 * against the page box, not the viewport.
 *
 * `Range.getClientRects()` returns more than one box for a match that occupies more
 * than one, and each becomes its own highlight element while keeping the index of the
 * logical match it belongs to.
 *
 * ## The single text mapping
 *
 * `collectNativePdfSearchPageText` builds the page string **and** the run boundaries
 * from the same source — a run's own text node — so a match offset, a `Range` offset and
 * the DOM the range is set in cannot disagree. A run whose first child is not a text
 * node contributes nothing at all: its characters could be matched but never measured,
 * which would be a match with no geometry.
 *
 * jsdom implements neither `Range.getClientRects()` nor
 * `Range.getBoundingClientRect()`, so the geometry tests install their own; that, plus
 * a human looking at the page, is the only way to check that a rectangle covers the
 * glyphs it should.
 */
import {
  findNativeTextLayer,
  NATIVE_PAGE_SELECTOR,
  NATIVE_TEXT_SPAN_SELECTOR
} from './nativePdfDom'

/** `Node.TEXT_NODE`. Named, because the literal is meaningless on its own. */
const TEXT_NODE = 3

/**
 * The fade-in the legacy highlight defers by `--duration-deliberate`.
 *
 * The animation itself (`pdf-highlight-fadein`) stays defined once, in the global
 * stylesheet, and is only *referenced* here — exactly as `safeRenderHighlights` does.
 * The delay is deliberate product behaviour, not an artefact: dozens of highlight divs
 * must not compete with page rasterization, so they fade in after the page settles.
 */
const HIGHLIGHT_FADE_ANIMATION =
  'pdf-highlight-fadein var(--duration-normal) ease var(--duration-deliberate) forwards'

/** A static, dimmed highlight when the user asked for reduced motion. */
const HIGHLIGHT_REDUCED_MOTION_OPACITY = '0.3'

/** A logical match: a keyword occurrence in the page's concatenated run text. */
export interface NativePdfSearchMatch {
  /** 1-based page the match was found on. */
  pageNumber: number
  /** Index of the first matched code unit in `NativePdfSearchPageText.text`. */
  start: number
  /** Index one past the last matched code unit. */
  end: number
  /** The keyword as the caller supplied it — the highlight's `title`, trimmed. */
  keyword: string
}

/** A page-relative highlight rectangle, in CSS pixels. */
export interface NativePdfSearchRect {
  top: number
  left: number
  width: number
  height: number
}

/** One highlight rectangle, plus the logical match it belongs to. */
export interface NativePdfSearchHighlight {
  /** Index of the logical match; several rectangles can share it. */
  matchIndex: number
  rect: NativePdfSearchRect
}

/** One measurable text run of the page. */
interface NativePdfSearchRun {
  /** Index in `text` at which this run's characters start. */
  offset: number
  length: number
  textNode: Text
}

/** A page's runs concatenated, with the boundaries a match is resolved against. */
export interface NativePdfSearchPageText {
  /** The page's text. Every match offset refers to exactly this string. */
  text: string
  runs: NativePdfSearchRun[]
}

/** One run's slice of a match, in that run's own text-node coordinates. */
interface NativePdfSearchRunGroup {
  run: NativePdfSearchRun
  start: number
  end: number
}

/**
 * The page's runs, concatenated, as one searchable string.
 *
 * Runs come from the renderer's own text-run selector (`role="presentation"`), the same
 * marker the page-text extractor reads, so a match can only be found where there is a
 * span a `Range` can be positioned in.
 */
export function collectNativePdfSearchPageText(
  layer: HTMLElement,
  spanSelector: string = NATIVE_TEXT_SPAN_SELECTOR
): NativePdfSearchPageText {
  const spans = layer.querySelectorAll<HTMLElement>(spanSelector)
  const runs: NativePdfSearchRun[] = []
  let text = ''
  for (const span of spans) {
    const first = span.firstChild
    // See the module note: a run without a text node cannot be measured, so it does
    // not enter the page text at all.
    if (!first || first.nodeType !== TEXT_NODE) continue
    const runText = first.textContent ?? ''
    if (!runText) continue
    runs.push({ offset: text.length, length: runText.length, textNode: first as Text })
    text += runText
  }
  return { text, runs }
}

/** Case-insensitive equality of two single UTF-16 code units. See the module note. */
function unitsMatch(haystackUnit: string, needleUnit: string): boolean {
  return haystackUnit === needleUnit || haystackUnit.toLowerCase() === needleUnit.toLowerCase()
}

/**
 * Every occurrence of `keyword` in the page text, in order, non-overlapping.
 *
 * Literal and case-insensitive, and nothing else: no word boundaries, no diacritic
 * folding, no whole-words mode. A whitespace-only keyword is not a search, which is the
 * one guard the legacy path applies before it starts matching.
 */
export function findNativePdfSearchMatches(
  pageText: NativePdfSearchPageText,
  keyword: string,
  pageNumber: number
): NativePdfSearchMatch[] {
  if (!keyword.trim()) return []
  const haystack = pageText.text
  const needleLength = keyword.length
  const matches: NativePdfSearchMatch[] = []
  let index = 0
  scan: while (index + needleLength <= haystack.length) {
    // Cheap prescreen on the first unit, then verify the rest.
    if (!unitsMatch(haystack.charAt(index), keyword.charAt(0))) {
      index += 1
      continue
    }
    for (let offset = 1; offset < needleLength; offset += 1) {
      if (!unitsMatch(haystack.charAt(index + offset), keyword.charAt(offset))) {
        index += 1
        continue scan
      }
    }
    matches.push({ pageNumber, start: index, end: index + needleLength, keyword })
    // Past the whole match, so two occurrences never overlap — the same result the
    // legacy path gets from a `g`-flagged regexp's `lastIndex`.
    index += needleLength
  }
  return matches
}

/** The runs a match touches, as slices in each run's own text-node coordinates. */
function groupMatchByRun(
  pageText: NativePdfSearchPageText,
  match: NativePdfSearchMatch
): NativePdfSearchRunGroup[] {
  const groups: NativePdfSearchRunGroup[] = []
  for (const run of pageText.runs) {
    const runEnd = run.offset + run.length
    if (runEnd <= match.start) continue
    if (run.offset >= match.end) break
    const start = Math.max(match.start, run.offset)
    const end = Math.min(match.end, runEnd)
    if (end <= start) continue
    // A single whitespace code unit is the gap between two words or two lines. The
    // legacy renderer draws nothing for it, and a rectangle over blank space would be
    // a visible difference on every multi-run match.
    if (end - start === 1 && pageText.text.charAt(start).trim() === '') continue
    groups.push({ run, start: start - run.offset, end: end - run.offset })
  }
  return groups
}

/**
 * The boxes a range occupies, as the browser reports them.
 *
 * A `Range` is the only geometry source on purpose: a match can cover more than one box
 * (a rotated run, a run that wraps), and the union rect would highlight text the keyword
 * did not match. An empty result means there is nothing to draw — a hidden run, or a
 * layer with no layout — and the caller drops the match rather than guessing.
 */
function clientRectsForRange(range: Range): readonly DOMRect[] {
  // jsdom implements neither Range geometry method; tests install their own stub.
  if (typeof range.getClientRects !== 'function') return []
  return [...range.getClientRects()]
}

/**
 * A measured rect in page-box coordinates, or `null` when it is not drawable.
 *
 * `NaN` and `Infinity` are refused before they can reach a style, as is a zero-area
 * rect: neither shows anything, and both are the kind of value a later zoom would
 * propagate.
 */
function toPageRelativeRect(rect: DOMRect, pageBox: DOMRect): NativePdfSearchRect | null {
  const left = rect.left - pageBox.left
  const top = rect.top - pageBox.top
  const { width, height } = rect
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  return { top, left, width, height }
}

/** Reading order for the overlay: top, then left — the legacy sort, unchanged. */
function compareHighlightPosition(
  a: NativePdfSearchHighlight,
  b: NativePdfSearchHighlight
): number {
  return a.rect.top - b.rect.top || a.rect.left - b.rect.left
}

/**
 * The drawable rectangles for a set of matches, measured against the live DOM.
 *
 * `pageBox` is the element every layer is positioned against, so a rect made relative
 * to it is in the canvas's coordinate space. Nothing here transforms or scales: the
 * runs are already rendered at the current scale and rotation.
 */
export function resolveNativePdfSearchHighlights(
  matches: readonly NativePdfSearchMatch[],
  pageText: NativePdfSearchPageText,
  pageBox: Element
): NativePdfSearchHighlight[] {
  if (matches.length === 0) return []
  const boxRect = pageBox.getBoundingClientRect()
  const highlights: NativePdfSearchHighlight[] = []
  for (const [matchIndex, match] of matches.entries()) {
    for (const group of groupMatchByRun(pageText, match)) {
      const range = document.createRange()
      try {
        range.setStart(group.run.textNode, group.start)
        range.setEnd(group.run.textNode, group.end)
      } catch {
        // The offsets are out of the node's range, which a run rebuild can make stale
        // in the window between two renders. Nothing to measure, so nothing to draw.
        continue
      }
      for (const rect of clientRectsForRange(range)) {
        const relative = toPageRelativeRect(rect, boxRect)
        if (relative) highlights.push({ matchIndex, rect: relative })
      }
    }
  }
  return highlights.sort(compareHighlightPosition)
}

/** The page box a search layer belongs to, or `null` when it is detached. */
export function findNativeSearchPageBox(searchLayer: Element): HTMLElement | null {
  return searchLayer.closest<HTMLElement>(NATIVE_PAGE_SELECTOR)
}

/** The text layer a search layer highlights, or `null` when there is none yet. */
export function findNativeSearchTextLayer(searchLayer: Element): HTMLElement | null {
  const pageBox = findNativeSearchPageBox(searchLayer)
  return pageBox ? findNativeTextLayer(pageBox) : null
}

/** The matches and the drawable rectangles for one keyword on one page. */
export interface NativePdfSearchResult {
  matches: NativePdfSearchMatch[]
  highlights: NativePdfSearchHighlight[]
}

/**
 * Search `pageNumber` in one page's live text layer.
 *
 * The one call the React layer makes, so matching, geometry and the text mapping cannot
 * be reached separately and drift apart.
 */
export function findNativePdfSearchHighlights(options: {
  keyword: string
  pageNumber: number
  pageBox: Element
  textLayer: HTMLElement
}): NativePdfSearchResult {
  const { keyword, pageNumber, pageBox, textLayer } = options
  const pageText = collectNativePdfSearchPageText(textLayer)
  const matches = findNativePdfSearchMatches(pageText, keyword, pageNumber)
  return { matches, highlights: resolveNativePdfSearchHighlights(matches, pageText, pageBox) }
}

/** How a highlight element is painted: geometry always, motion per the preference. */
export interface NativePdfSearchHighlightOptions {
  /** Becomes the element's `title`, trimmed — the legacy `area.keywordStr.trim()`. */
  keyword: string
  reducedMotion: boolean
}

/**
 * Draw the highlights into `layer`, replacing whatever was there.
 *
 * `replaceChildren` rather than a diff, for the same reason the other two layers clear
 * their containers: a superseded overlay has to be gone before the next one is measured,
 * not after. The element contract is
 * `data-native-pdf-search-highlight` + `data-native-pdf-search-index` (this rectangle)
 * + `data-native-pdf-search-match` (the logical match it belongs to) — QuizLab's own
 * attributes, never the legacy plugin's class name.
 */
export function renderNativePdfSearchHighlights(
  layer: HTMLElement,
  highlights: readonly NativePdfSearchHighlight[],
  options: NativePdfSearchHighlightOptions
): void {
  const title = options.keyword.trim()
  const fragment = document.createDocumentFragment()
  for (const [index, highlight] of highlights.entries()) {
    const element = document.createElement('div')
    element.setAttribute('data-native-pdf-search-highlight', '')
    element.setAttribute('data-native-pdf-search-index', String(index))
    element.setAttribute('data-native-pdf-search-match', String(highlight.matchIndex))
    const style = element.style
    style.left = `${highlight.rect.left}px`
    style.top = `${highlight.rect.top}px`
    style.width = `${highlight.rect.width}px`
    style.height = `${highlight.rect.height}px`
    if (options.reducedMotion) {
      style.opacity = HIGHLIGHT_REDUCED_MOTION_OPACITY
    } else {
      style.opacity = '0'
      style.animation = HIGHLIGHT_FADE_ANIMATION
    }
    element.title = title
    fragment.append(element)
  }
  layer.replaceChildren(fragment)
}

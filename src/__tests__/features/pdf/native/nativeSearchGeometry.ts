/**
 * A miniature layout engine for the native search tests.
 *
 * ## Why it exists
 *
 * jsdom has no layout: every `getBoundingClientRect()` is zero and **`Range` implements
 * neither `getClientRects()` nor `getBoundingClientRect()`**. The production search reads
 * geometry from `Range.getClientRects()` and subtracts the page box's own rect, so without
 * a stand-in every test would observe "no highlights" and prove nothing about geometry.
 *
 * This is the same trade the other native tests already make — a *declared* fake for the
 * one thing jsdom cannot do — and it is what the migration plan means by "unit tests
 * geometry mocks + manual smoke required". It proves the arithmetic (offsets →
 * rects → page-relative pixels → attributes) and the lifecycle; it cannot prove that a
 * rectangle covers the glyphs it should, and nothing here pretends to.
 *
 * ## What the stand-in models
 *
 * Runs are laid out on a grid, like the text layer's absolutely-positioned runs: one row
 * per `runsPerRow` runs, each box derived from the run's index and the current scale. So:
 *
 *  - a *zoom* is `setScale(1.5)` and every box moves and grows, which is what makes the
 *    stale-geometry test meaningful;
 *  - a *page change* is different runs, therefore different boxes, because the index is
 *    resolved against whatever runs are in the layer right now;
 *  - a *rotation* needs no special case: the production code never looks at the viewport,
 *    it measures rendered runs relative to the page box, and a rotated page is the same
 *    computation with different client coordinates.
 *
 * A range over one run is that run's box narrowed to the matched fractions of its text.
 * Multiple boxes for one range — a rotated or wrapped run — are opt-in through
 * `rangeRects`, so the multi-rectangle path is reachable deliberately rather than by
 * accident.
 */

/** A plain rectangle, which is all the tests need to talk about. */
export interface StubRect {
  left: number
  top: number
  width: number
  height: number
}

export interface NativeSearchGeometryOptions {
  /** Client coordinates of the page box's top-left corner. Default `0, 0`. */
  pageOrigin?: { left: number; top: number }
  /** Page box size in CSS pixels at scale 1. Default `400 × 600`. */
  pageSize?: { width: number; height: number }
  /** Runs per visual row before the next row starts. Default `4`. */
  runsPerRow?: number
  /** The current scale. Tests move it to stand in for a zoom. */
  scale?: number
  /** Overrides the per-range geometry, for the multiple-rectangles case. */
  rangeRects?: (range: Range, box: StubRect | null) => StubRect[]
}

export interface NativeSearchGeometryHandle {
  /** Give the rendered page element a real box at `scale`, which the run boxes share. */
  attachPageBox(pageBox: HTMLElement, scale?: number): void
  /** Move and resize every run box. The page box follows, since it is the same scale. */
  setScale(scale: number): void
  /** The page rect currently in effect, in client coordinates. */
  pageRect(): StubRect
  /** Remove the `Range` stub. Call from `afterEach`. */
  restore(): void
}

function toDomRect(rect: StubRect): DOMRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({})
  } as DOMRect
}

export function installNativeSearchGeometry(
  options: NativeSearchGeometryOptions = {}
): NativeSearchGeometryHandle {
  const origin = options.pageOrigin ?? { left: 0, top: 0 }
  const size = options.pageSize ?? { width: 400, height: 600 }
  const runsPerRow = options.runsPerRow ?? 4
  let scale = options.scale ?? 1
  let pageBox: HTMLElement | null = null

  const pageRect = (): StubRect => ({
    left: origin.left,
    top: origin.top,
    width: size.width * scale,
    height: size.height * scale
  })

  /** The run's position in its own text layer, so a rebuilt layer lays out again. */
  const runIndex = (node: Node | null): number => {
    const element = node?.nodeType === 1 ? (node as Element) : node?.parentElement
    const siblings = element?.parentElement?.querySelectorAll('span[role="presentation"]')
    if (!element || !siblings) return -1
    return [...siblings].indexOf(element)
  }

  const runBox = (node: Node | null): StubRect | null => {
    const index = runIndex(node)
    if (index < 0) return null
    const column = index % runsPerRow
    const row = Math.floor(index / runsPerRow)
    return {
      left: origin.left + (20 + column * 90) * scale,
      top: origin.top + (30 + row * 20) * scale,
      width: 80 * scale,
      height: 12 * scale
    }
  }

  const geometryFor = (range: Range): DOMRect[] => {
    if (options.rangeRects) {
      return options.rangeRects(range, runBox(range.startContainer)).map(toDomRect)
    }
    const box = runBox(range.startContainer)
    const node = range.startContainer
    const length = node?.textContent?.length ?? 0
    if (!box || length === 0) return []
    // Narrow the run's box to the matched fractions of its text, the way a browser
    // narrows a range's box to the characters it covers.
    const xAt = (offset: number) => box.left + (box.width * offset) / length
    const left = xAt(range.startOffset)
    const width = xAt(range.endOffset) - left
    if (width <= 0) return []
    return [toDomRect({ left, top: box.top, width, height: box.height })]
  }

  const descriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects')
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    writable: true,
    // The production code only ever does `Array.from(...)` on this, and jsdom has no
    // constructible `DOMRectList`, so an array is the honest stand-in.
    value(this: Range) {
      return geometryFor(this) as unknown as DOMRectList
    }
  })

  return {
    attachPageBox(element, nextScale) {
      pageBox = element
      if (nextScale !== undefined) scale = nextScale
      Object.defineProperty(element, 'getBoundingClientRect', {
        configurable: true,
        value: () => toDomRect(pageRect())
      })
    },
    setScale(nextScale) {
      scale = nextScale
      // The page box is re-stamped so both sides of the subtraction always describe the
      // same zoom, which is what a real viewport change does.
      if (pageBox) this.attachPageBox(pageBox, nextScale)
    },
    pageRect,
    restore() {
      if (descriptor) Object.defineProperty(Range.prototype, 'getClientRects', descriptor)
      else delete (Range.prototype as { getClientRects?: unknown }).getClientRects
    }
  }
}

/** The highlight elements currently inside a search overlay. */
export function highlightsIn(
  root: ParentNode,
  selector = '[data-native-pdf-search-highlight]'
): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector)]
}

/** The search overlay inside a rendered native page. */
export function searchLayerOf(root: ParentNode): HTMLElement {
  const layer = root.querySelector<HTMLElement>('[data-native-pdf-search-layer]')
  if (!layer) throw new Error('the native search layer is not mounted')
  return layer
}

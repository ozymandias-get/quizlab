/**
 * The native viewer's text **selection presentation** contract.
 *
 * ## What this file protects
 *
 * Three properties, each of which a well-meaning CSS edit could silently undo:
 *
 *  1. **The selection colour is the user's.** The tint is derived from the
 *     `selectionColor` preference, so choosing purple paints purple. An agent that
 *     "fixed" the heavy look by hard-coding a colour would keep every test green
 *     while quietly ignoring the setting, which is the failure this file exists to
 *     make loud.
 *  2. **Selection is independent of search highlight.** They are different features
 *     with different CSS files, and a change to one that reaches into the other
 *     would couple `Ctrl+F` results to mouse selection.
 *  3. **Presentation did not become geometry.** No rule in the selection block may
 *     grow a property that moves, resizes or fakes the highlight box — no `padding`,
 *     `margin`, `border`, `transform`, `box-shadow`, `filter`, `border-radius`. The
 *     selection rect is the browser's to paint; a stylesheet that starts drawing its
 *     own is a TextLayer geometry rewrite wearing a disguise, which the migration
 *     explicitly rules out of this phase.
 *
 * ## Why these are source-level assertions
 *
 * jsdom has no cascade for pseudo-elements: `getComputedStyle(el, '::selection')`
 * resolves against no stylesheet at all, and importing the CSS would not change that.
 * A test that asserted a *computed* selection colour here would be asserting its own
 * string back at itself. So this file reads the stylesheet and asserts the contract
 * the stylesheet is responsible for, which is the same approach
 * `architecture/pdfjs-single-runtime.test.ts` takes for the shared keyframe.
 *
 * What it deliberately does **not** claim is any particular pixel: "the tint is
 * exactly 32%" is a decision that may be revisited, whereas "the tint comes from the
 * user's colour and no hard-coded colour ever replaces it" is the invariant.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..')
const sourceOf = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf-8')

const textLayerCss = sourceOf('src/features/pdf/native/nativePdfTextLayer.css')
const searchLayerCss = sourceOf('src/features/pdf/native/nativePdfSearchLayer.css')
const appEffects = sourceOf('src/app/effects/AppEffects.tsx')

/**
 * The `::selection` rules of the text layer, comments stripped.
 *
 * Scoped by hand rather than by a CSS parser because the assertion is about which
 * declarations sit next to `::selection`; reading the file's own text keeps the
 * failure message pointing at a line in a real file.
 */
function selectionRules(css: string): string {
  return css
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('/*'))
    .join('\n')
}

/** The selection block: from the layer's `::selection` selector to its closing brace. */
const selectionBlock = (() => {
  const rules = selectionRules(textLayerCss)
  const start = rules.indexOf('[data-native-pdf-text-layer] ::selection {')
  expect(start, 'the text layer must still declare its own ::selection').toBeGreaterThan(-1)
  const end = rules.indexOf('\n}', start)
  return rules.slice(start, end)
})()

/** The one place the selection's colour and alpha are derived. */
const tintDeclaration = (() => {
  const declaration = selectionRules(textLayerCss).match(/--native-pdf-selection-tint:[^;]*/)?.[0]
  expect(declaration, 'the selection tint must be declared as a custom property').toBeDefined()
  return declaration as string
})()

/** The rule PDF.js's text runs are styled by — the selectable leaves themselves. */
const runSelectionBlock = (() => {
  const rules = selectionRules(textLayerCss)
  const start = rules.indexOf('[data-native-pdf-text-layer] :is(span, br) {')
  expect(start, 'the text runs must still declare their own selection rule').toBeGreaterThan(-1)
  return rules.slice(start, rules.indexOf('\n}', start))
})()

/**
 * The frame's own block, located *after* the runs rule.
 *
 * `[data-native-pdf-text-layer] {` appears twice — once for the layer's geometry
 * contract and once for the selection containment — so it is found by offset rather
 * than by first match. Anchoring on the runs rule's own end is what keeps this from
 * silently re-pointing at the geometry block if the file is ever reordered.
 */
const layerContainmentBlock = (() => {
  const rules = selectionRules(textLayerCss)
  const start = rules.indexOf('\n}', rules.indexOf('[data-native-pdf-text-layer] :is(span, br) {'))
  const blockStart = rules.indexOf('[data-native-pdf-text-layer] {', start)
  expect(blockStart, 'the text layer must still declare its own containment rule').toBeGreaterThan(
    -1
  )
  expect(blockStart).toBeLessThan(rules.indexOf('[data-native-pdf-text-layer] .markedContent'))
  return rules.slice(blockStart, rules.indexOf('\n}', blockStart))
})()

describe("native selection presentation — the colour is the user's", () => {
  it('derives the tint from the selectionColor preference rather than a fixed colour', () => {
    // `color-mix` over the raw preference is the mechanism; what matters is that the
    // alpha is *derived* from whatever the user picked rather than baked into a
    // pre-mixed rgba that no longer has the user's hue in it. The mix lives on the
    // layer's custom property, and `::selection` consumes that one token, so the
    // alpha is declared once for the whole selection surface.
    expect(tintDeclaration).toMatch(/color-mix\(\s*in srgb,\s*var\(--selection-color-source/)
    expect(tintDeclaration).toContain('transparent')
    expect(selectionBlock).toContain('var(--native-pdf-selection-tint')
  })

  it('publishes --selection-color-source from the same preference as the other tokens', () => {
    // One setting, one source. If this line were dropped, `color-mix` would silently
    // fall back to the built-in amber default and a purple selection would render
    // amber — a failure with no runtime error anywhere.
    expect(appEffects).toMatch(/setProperty\(\s*'--selection-color-source',\s*color\s*\)/)
    // Still derived from the hook's `selectionColor`, not a second, unrelated source.
    expect(appEffects).toMatch(
      /const selectionColor = useAppearance\(\(state\) => state\.selectionColor\)/
    )
  })

  it('hard-codes no selection colour where the selection paints', () => {
    // Exactly one literal colour is allowed in this styling: the `var()` fallback
    // inside the tint, which is what paints only before the preference has ever been
    // published. Anything else — a second hex, or an `rgb()`/`hsl()` literal in the
    // `::selection` rule itself — is a colour able to disagree with the user's.
    expect(tintDeclaration.match(/#[0-9a-f]{3,8}/gi) ?? []).toHaveLength(1)
    expect(selectionBlock.match(/#[0-9a-f]{3,8}/gi) ?? []).toHaveLength(0)
    expect(selectionBlock.match(/(rgb|rgba|hsl|hsla|oklch|color)\(/gi) ?? []).toHaveLength(1)
  })
})

describe('native selection presentation — it is not the search highlight', () => {
  it('keeps search vocabulary out of the text layer stylesheet', () => {
    // `data-native-pdf-search-*` and `pdf-highlight-fadein` belong to `Ctrl+F`. If the
    // selection block ever referenced either, mouse selection and find would start
    // sharing paint.
    expect(textLayerCss).not.toContain('data-native-pdf-search')
    expect(textLayerCss).not.toContain('pdf-highlight-fadein')
  })

  it('keeps the selection tint out of the search highlight stylesheet', () => {
    // Same argument in the other direction. The search highlight is yellow on
    // purpose — it is a find result, not the user's selection colour — and it stays
    // independent of whatever the user picked for selection.
    expect(searchLayerCss).not.toContain('--selection-color')
    expect(searchLayerCss).not.toContain('::selection')
  })

  it('leaves the search highlight geometry and animation untouched', () => {
    // Pinned so "improve selection appearance" can never quietly become "redesign
    // the find highlight": the radius and the 40% yellow are the search layer's own.
    expect(searchLayerCss).toContain('border-radius: 0.25rem')
    expect(searchLayerCss).toContain('rgb(255 255 0 / 0.4)')
  })
})

describe('native selection presentation — it does not fake a highlight', () => {
  const geometryProperties = [
    'padding',
    'margin',
    'border',
    'transform',
    'box-shadow',
    'filter',
    'border-radius',
    'inset',
    'width',
    'height'
  ]

  it('adds no geometry-affecting property to ::selection', () => {
    for (const property of geometryProperties) {
      expect(selectionBlock, `::selection must not declare ${property}`).not.toMatch(
        new RegExp(`(^|[;{\\s])${property}\\s*:`)
      )
    }
  })

  it('adds no geometry-affecting property to the line-break rule', () => {
    // The `<br>` rule is presentation-only: it removes paint, it must not reshape
    // anything. A `padding` or `border-radius` here would be the styling shortcut
    // this whole approach rejects.
    const brRule = selectionRules(textLayerCss).match(
      /\[data-native-pdf-text-layer\] br::selection \{[^}]*\}/
    )?.[0]
    expect(brRule, 'the br rule must still exist').toBeDefined()
    expect(brRule).toContain('background: transparent')
    for (const property of geometryProperties) {
      expect(brRule).not.toMatch(new RegExp(`(^|[;{\\s])${property}\\s*:`))
    }
  })

  it('keeps the selection foreground transparent, so the canvas glyphs stay the only copy', () => {
    // Forcing `color: white` or `color: black` here would paint a second, mismatched
    // set of glyphs on top of the canvas's. The run text is invisible by design.
    expect(selectionBlock).toContain('color: transparent')
  })

  it('does not replace the browser-painted selection with a custom one', () => {
    // No overlay element, no range-rectangle renderer, no injected markup: the
    // selection is still whatever `window.getSelection()` paints.
    expect(textLayerCss).not.toMatch(/pdf-selection-overlay|selection-rect|Range\(/)
    expect(textLayerCss).not.toContain('backdrop-filter')
  })
})

/**
 * The double-paint contract.
 *
 * ## What the bug was
 *
 * PDF.js emits **one `<span role="presentation">` per text item** and positions
 * each with its own `left`/`top` and `--scale-x`. Measured in Chromium 142 against
 * PDF.js 6.4.299's real `TextLayer`, on a bullet/list page:
 *
 *  - A run selected **on its own** paints exactly its own box. Overhang measured at
 *    0.00px for `--scale-x` 1.0, 1.1, 1.188, 1.4, 1.6196 and 2.0.
 *  - The same run selected **together with the next run on the line** then paints
 *    ~3-4px past its own right edge, and the overhang does not change with
 *    `--scale-x`. It tracks the *line*, not the run.
 *
 * Consecutive run boxes *abut* (PDF.js places run N+1 at the PDF's own advance), so
 * the first run's overhang lands inside the next run's box and **both runs paint the
 * same pixels**. Two translucent tints over one pixel is a darker pixel — measured
 * on the production 32% tint as `248,230,176` for a single paint against
 * `243,213,122` for the boundary band. That band is the dark block at the start of
 * bullet lines, indented lines and any run boundary.
 *
 * ## The fix, and why this test can pin it
 *
 * `overflow-x: clip` on each run removes the second painter rather than hiding the
 * symptom: a run's box *is* its share of the line, so clipping paint to it
 * guarantees one painter per pixel.
 *
 * jsdom resolves no cascade and has no box model, so this cannot assert a computed
 * value — the measurements above came from a real browser. What *is* assertable, and
 * is the part that would silently regress, is that the fix stays in place and stays
 * shaped correctly.
 */
describe('native selection presentation — no double paint at run boundaries', () => {
  /** The rule PDF.js's text runs are styled by: `> :not(.markedContent)`. */
  const runGeometryBlock = (() => {
    const rules = selectionRules(textLayerCss)
    const start = rules.indexOf(
      '[data-native-pdf-text-layer] > :not(.markedContent),\n[data-native-pdf-text-layer] .markedContent span:not(.markedContent) {'
    )
    expect(start, 'the text runs must still be styled by the PDF.js geometry rule').toBeGreaterThan(
      -1
    )
    const end = rules.indexOf('\n}', start)
    return rules.slice(start, end)
  })()

  it('clips each run selection paint to that run own box', () => {
    // The fix. Without it, every run boundary on every line composites the tint
    // twice and the band reads as a darker block.
    expect(runGeometryBlock).toContain('overflow-x: clip')
  })

  it('clips horizontally only', () => {
    // `overflow: clip` on both axes also clips the highlight's vertical extent to
    // the run's line box, which visibly shortens the highlight at the top and
    // bottom of every line. The x axis is the whole fix; y must stay unclipped.
    expect(runGeometryBlock).not.toMatch(/(^|[;{\s])overflow\s*:/)
  })

  it('does not use hidden/auto, which would scroll instead of clip', () => {
    // `overflow-x: hidden` computes the other axis to `auto` and makes the run a
    // scroll container. `clip` is the value that keeps the untouched axis visible.
    expect(runGeometryBlock).not.toMatch(/overflow-x\s*:\s*(hidden|auto|scroll|visible)/)
  })

  it('clips the runs, not the layer, so nothing is clipped at page edges', () => {
    // The layer already has `overflow: clip` from PDF.js's own stylesheet. If the
    // run rule ever stopped carrying its own clip, the boundary double paint would
    // come back while this file still *looks* like it has a clip.
    expect(runGeometryBlock).toMatch(/overflow-x\s*:\s*clip/)
    const layerBlock = selectionRules(textLayerCss).slice(
      0,
      selectionRules(textLayerCss).indexOf(
        '\n}',
        selectionRules(textLayerCss).indexOf('[data-native-pdf-text-layer] {')
      )
    )
    expect(layerBlock).not.toMatch(/overflow-x\s*:/)
  })

  it('keeps the line-break rule, which is a separate artefact', () => {
    // A `<br>` is a zero-width line break that paints its own rect at the layer's
    // origin. Clipping runs does not cover that, so the br rule has to stay.
    expect(textLayerCss).toContain('[data-native-pdf-text-layer] br::selection')
    expect(textLayerCss).toContain('[data-native-pdf-text-layer] br::-moz-selection')
  })

  it('does not clip the bullet glyph out of being selectable', () => {
    // The bullet is a real text run — `•` is a separate PDF text item, and it has to
    // stay selectable so `Ctrl+C` copies `• Vazoaktif ilaç`. `overflow-x` clips
    // paint only; it must never have become `user-select: none` on runs.
    expect(runGeometryBlock).not.toMatch(/user-select\s*:\s*none/)
    // And the only three rules in the file that make anything unselectable are: the
    // layer frame itself (see the containment contract below), the image
    // placeholder (no glyph behind it), and pan mode (a drag surface, not a text
    // surface). A fourth would mean some real run had been silenced.
    const unselectable = (
      selectionRules(textLayerCss).match(/[^{}]*\{[^}]*user-select:\s*none[^}]*\}/g) ?? []
    ).map((rule) => rule.split('{')[0].trim())
    expect(unselectable).toHaveLength(3)
    expect(unselectable[0]).toBe('[data-native-pdf-text-layer]')
    expect(unselectable[1]).toContain("span[role='img']")
    expect(unselectable[2]).toContain('pdf-pan-mode-active')
  })

  it('leaves the selection API and extraction reading the same boxes', () => {
    // `overflow-x` clips paint, not layout: `getClientRects()` returns identical
    // boxes with and without it. `extractSelectedText` orders by those rects, and
    // the search layer measures the same runs, so a clip that *did* move geometry
    // would break column reading order and Ctrl+F positioning. Pin the call sites
    // that consume them.
    const extract = sourceOf('src/features/pdf/text/extractSelectedText.ts')
    expect(extract).toContain('getClientRects')
    const search = sourceOf('src/features/pdf/native/nativePdfSearch.ts')
    expect(search).toContain('getClientRects')
  })
})

describe('native selection presentation — behaviour is untouched', () => {
  /**
   * The text layer is a *frame*, and the frame must not be a selection surface.
   *
   * ## Why this is here
   *
   * PDF.js emits one absolutely positioned span per text item, so every run is a
   * block-level box: there is no line box spanning a line's runs, and no run whose
   * box covers the empty space to the right of the last glyph. Measured in
   * Chromium 142 with `document.caretPositionFromPoint`, every point in that empty
   * space — and every point in the ~1px inter-line gap — resolves to a caret
   * position *between the layer's children* rather than to a text position:
   *
   * ```
   *   x = the run's right edge   -> run#1@0    the end of the run
   *   x = 1px past it            -> LAYER@9    a position between children
   *   y = the line's bottom      -> run#1@37
   *   y = 1px below it           -> LAYER@9
   *   y = 2px below it           -> run#2@38   the next line, correctly
   * ```
   *
   * A selection ending on such a boundary covers every block between the anchor and
   * it, so 1px of movement selected a whole paragraph. `user-select: none` on the
   * frame removes that position from the set Chromium will produce and the nearest
   * valid text position is used instead — 289 characters over 10 painted rects
   * became 51 characters over 1 rect on the same 1px drag.
   *
   * jsdom resolves no cascade and `caretPositionFromPoint` does not exist there, so
   * like the rest of this file the contract is asserted on the stylesheet's own
   * text. What matters structurally is that the rule lands on the *frame* and that
   * the runs above it are untouched — a `user-select: none` that reached the runs
   * would be the exact regression the previous test counts rules for.
   */
  it('makes the layer frame itself unselectable without touching the runs', () => {
    // The frame carries no text of its own — PDF.js puts only runs and `<br>`s in it.
    expect(layerContainmentBlock).toContain('user-select: none')
    expect(layerContainmentBlock).toContain('-webkit-user-select: none')

    // The runs keep `user-select: text`, and they are the more specific rule, so a
    // reader can still drag over every PDF text item.
    expect(runSelectionBlock).toContain('user-select: text')
    expect(runSelectionBlock).not.toMatch(/user-select\s*:\s*none/)

    // And it costs no geometry: the whole point is a boundary, not a repaint.
    for (const property of [
      'font-size',
      'transform',
      'left',
      'top',
      'width',
      'height',
      'padding',
      'margin'
    ]) {
      expect(
        layerContainmentBlock,
        `the containment rule must not declare ${property}`
      ).not.toMatch(new RegExp(`(^|[;{\\s])${property}\\s*:`))
    }
  })

  it('leaves the active-selection state class and its rule in place', () => {
    // `usePdfTextActions` toggles this and the AI quick bar reads the same state.
    // Presentation polish does not get to change when a selection is considered
    // "active".
    expect(textLayerCss).toContain(
      '.pdf-viewer-container.pdf-selection-active [data-native-pdf-text-layer]'
    )
    const codeOfTextActions = sourceOf('src/features/pdf/text/usePdfTextActions.ts')
    expect(codeOfTextActions).toContain("'pdf-selection-active'")
  })

  it('keeps the text layer geometry contract exactly as PDF.js defines it', () => {
    // Position, transform and font-size are what make the browser highlight the box
    // the user sees. A change to any of these is a TextLayer geometry change, not a
    // selection-styling change, so they are pinned here.
    expect(textLayerCss).toContain('--font-height: 0')
    expect(textLayerCss).toContain('font-size: calc(var(--text-scale-factor) * var(--font-height))')
    expect(textLayerCss).toContain(
      'transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))'
    )
    expect(textLayerCss).toContain('transform-origin: 0% 0%')
  })

  it('still drops user-select in pan mode', () => {
    // Pan mode is a drag surface. Losing this would make a pan start a selection.
    expect(textLayerCss).toContain(
      '.pdf-viewer-container.pdf-pan-mode-active [data-native-pdf-text-layer] :is(span, br)'
    )
  })

  it('does not read or write the selection API from CSS-adjacent code', () => {
    // `getSelection()` / `Range` stay where they were: extraction is not CSS's job.
    const textLayerHook = sourceOf('src/features/pdf/native/useNativePdfTextLayer.ts')
    expect(textLayerHook).not.toContain('getSelection')
    expect(textLayerHook).not.toContain('createRange')
  })
})

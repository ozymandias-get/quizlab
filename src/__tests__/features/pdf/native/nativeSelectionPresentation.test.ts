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

describe('native selection presentation — behaviour is untouched', () => {
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

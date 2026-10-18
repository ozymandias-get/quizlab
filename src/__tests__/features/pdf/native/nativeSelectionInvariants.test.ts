/**
 * Four selection invariants stylelint cannot express.
 *
 * The repository already lints `nativePdfTextLayer.css` with
 * `stylelint-config-standard` (`npm run analyze:css`, clean today), and that covers
 * syntax, unknown properties and value conventions. It has no rule for "this
 * declaration must never appear in this rule", so four product decisions would
 * otherwise be unguarded:
 *
 *  1. **The selection colour is the user's.** `--selection-color-source` is published
 *     from the `selectionColor` preference. If that line were dropped, `color-mix`
 *     would fall back to the built-in amber default and a purple selection would
 *     render amber — no runtime error anywhere.
 *  2. **`::selection` must not become geometry.** The selection rect is the
 *     browser's to paint. A `padding`, `border`, `transform`, `box-shadow` or
 *     `filter` there is an attempt to draw a *different* highlight, not to polish
 *     this one.
 *  3. **The `<br>` rule is presentation-only.** PDF.js emits a `<br>` after every
 *     run that ends a line; it paints a dense colour block with nothing behind it.
 *     `background: transparent` removes the paint — and nothing else may change.
 *  4. **The bullet glyph stays selectable.** `•` is its own PDF text item, so
 *     `Ctrl+C` has to be able to copy it. `user-select: none` must never reach the
 *     run rule, and exactly three rules in the file may opt out at all.
 *
 * jsdom resolves no cascade and has no box model, so `getComputedStyle(el,
 * '::selection')` would resolve against no stylesheet at all — a test asserting a
 * *computed* colour here would be asserting its own string back at itself. The
 * contract is therefore read off the stylesheet's own text.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..')
const sourceOf = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf-8')

/** Comments stripped, then every top-level rule split into selector + body. */
const rulesOf = (css: string): { selector: string; body: string }[] => {
  const withoutComments = css.replaceAll(/\/\*[\s\S]*?\*\//g, '')
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    body: match[2]
  }))
}

const textLayerRules = rulesOf(sourceOf('src/features/pdf/native/nativePdfTextLayer.css'))

function ruleFor(selector: string, mustMatch?: RegExp): string {
  // `selector` is declared more than once in this file, so `mustMatch` picks
  // which block is meant rather than silently taking the first.
  const rule = textLayerRules.find(
    (candidate) =>
      candidate.selector === selector && (mustMatch === undefined || mustMatch.test(candidate.body))
  )
  if (!rule) throw new Error(`the text layer no longer declares \`${selector}\``)
  return rule.body
}

/** Declarations that would move, resize or repaint the browser's selection box. */
const GEOMETRY_PROPERTIES = [
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

const declaresGeometry = (body: string): string | undefined =>
  GEOMETRY_PROPERTIES.find((property) => new RegExp(`^\\s*${property}\\s*:`, 'm').test(body))

describe('native text layer — selection invariants', () => {
  it('publishes --selection-color-source from the selectionColor preference', () => {
    // One setting, one source. Without this the CSS `color-mix` silently falls back
    // to its amber default and the user's chosen colour is ignored.
    const appEffects = sourceOf('src/app/effects/AppEffects.tsx')

    expect(appEffects).toMatch(/setProperty\(\s*'--selection-color-source',\s*color\s*\)/)
    // Still derived from the appearance store, not from a second unrelated source.
    expect(appEffects).toMatch(
      /const selectionColor = useAppearance\(\(state\) => state\.selectionColor\)/
    )
    // And the tint still consumes that one token rather than a baked-in rgba.
    const tint = ruleFor('[data-native-pdf-text-layer]', /--native-pdf-selection-tint/)
    expect(tint).toMatch(/--native-pdf-selection-tint:[^;]*var\(--selection-color-source/)
  })

  it('adds no geometry-affecting property to ::selection', () => {
    const body = ruleFor('[data-native-pdf-text-layer] ::selection')

    const offending = declaresGeometry(body)
    expect(offending, `::selection must not declare ${offending}`).toBeUndefined()
    // The tint is consumed as one custom property, not re-mixed here.
    expect(body).toContain('var(--native-pdf-selection-tint')
  })

  it('adds no geometry-affecting property to the line-break rule', () => {
    const body = ruleFor('[data-native-pdf-text-layer] br::selection')

    // Presentation-only: it removes paint, it must not reshape anything.
    expect(body).toContain('background: transparent')
    const offending = declaresGeometry(body)
    expect(offending, `the br rule must not declare ${offending}`).toBeUndefined()
  })

  it('does not clip the bullet glyph out of being selectable', () => {
    const runGeometry = ruleFor(
      '[data-native-pdf-text-layer] > :not(.markedContent),\n' +
        '[data-native-pdf-text-layer] .markedContent span:not(.markedContent)'
    )

    // `•` is a real text item; `overflow-x: clip` clips paint, so it must never
    // have become `user-select: none` on the runs.
    expect(runGeometry).not.toMatch(/user-select\s*:\s*none/)

    // Exactly three rules opt out, and each is deliberate: the layer frame (it holds
    // no text), the image placeholder (no glyph behind it) and pan mode (a drag
    // surface, not a text surface). A fourth would mean a real run had been silenced.
    const unselectable = textLayerRules
      .filter((rule) => /user-select\s*:\s*none/.test(rule.body))
      .map((rule) => rule.selector)

    expect(unselectable).toEqual([
      '[data-native-pdf-text-layer]',
      "[data-native-pdf-text-layer] span[role='img']",
      '.pdf-viewer-container.pdf-pan-mode-active [data-native-pdf-text-layer],\n' +
        '.pdf-viewer-container.pdf-pan-mode-active [data-native-pdf-text-layer] :is(span, br)'
    ])
  })
})

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * `.low-perf` was added to <html> by AppEffects for reduced-motion / <=4 core /
 * <=4 GB machines, but no stylesheet ever defined it. The class was inert: a
 * low-end machine still paid for the two continuously animating ambient layers,
 * each of which combines a 70px blur radius with `mix-blend-mode` (which forces
 * the compositor to read back the backdrop underneath it every frame).
 *
 * Because jsdom does not evaluate the stylesheets, the guard has to read the
 * CSS source. This locks in that the class is not inert again, and specifically
 * that it degrades the properties that actually cost GPU time.
 */

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../../shared/styles/modules/_backgrounds.css'), 'utf8')

/** Extract the declaration block of the rule whose selector list mentions `sel`. */
const declarationsFor = (selectorFragment: string): string => {
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  const matches = blocks
    .filter(([, selector]) => selector.includes(selectorFragment))
    .map(([, , body]) => body)
  expect(matches.length, `no rule found for ${selectorFragment}`).toBeGreaterThan(0)
  return matches.join('\n')
}

describe('low-perf performance class', () => {
  it('defines rules for the class AppEffects applies', () => {
    expect(css).toMatch(/\.low-perf\b/)
  })

  it('stops the infinite ambient animation', () => {
    const body = declarationsFor('.low-perf .app-ambient-background::before')
    expect(body).toMatch(/animation:\s*none/)
    expect(body).toMatch(/animation-play-state:\s*paused/)
  })

  it('drops the layer promotion and the backdrop-reading blend', () => {
    const body = declarationsFor('.low-perf .app-ambient-background::before')
    expect(body).toMatch(/will-change:\s*auto/)
    expect(body).toMatch(/mix-blend-mode:\s*normal/)
  })

  it('reduces the blur radius instead of leaving a 70px filter in place', () => {
    const body = declarationsFor('.low-perf .app-ambient-background::before')
    const blur = /filter:\s*blur\((\d+)px\)/.exec(body)
    expect(blur).not.toBeNull()
    expect(Number(blur![1])).toBeLessThan(70)
  })

  it('removes the masked soft-light noise layer', () => {
    expect(declarationsFor('.low-perf .app-ambient-background .bg-noise')).toMatch(
      /display:\s*none/
    )
  })

  it('applies to both ambient pseudo-elements', () => {
    expect(css).toMatch(
      /\.low-perf \.app-ambient-background::before,\s*\n?\s*\.low-perf \.app-ambient-background::after/
    )
  })

  it('does not change the default (non low-perf) ambient rendering', () => {
    const defaultBefore = declarationsFor('.app-ambient-background::before')
    expect(defaultBefore).toMatch(/filter:\s*blur\(70px\)/)
    expect(defaultBefore).toMatch(/mix-blend-mode:\s*screen/)
    expect(defaultBefore).toMatch(/will-change:\s*transform/)
    expect(defaultBefore).toMatch(/animation:\s*ambientDriftA/)
  })
})

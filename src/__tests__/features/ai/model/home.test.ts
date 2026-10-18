/**
 * Tests for src/features/ai/model/home.ts — pure functions used by the
 * AI home screen layout. Regressions here cause the wrong platforms to
 * be shown in the model/site sections.
 */
import type { AiPlatform } from '@shared-core/types'

import { describe, expect, it } from 'vitest'

import {
  type AiSiteMap,
  getEnabledAiIdsByType,
  mergeOrderedIds,
  safeAiAccentColor
} from '../../../../features/ai/model/home'

function makeSite(id: string, opts: Partial<AiPlatform> = {}): AiPlatform {
  return {
    id,
    name: id,
    url: `https://${id}.com`,
    isSite: false,
    ...opts
  } as AiPlatform
}

describe('safeAiAccentColor', () => {
  const DEFAULT_ACCENT = '#6ee7b7'

  // Every rejected shape collapses to the same fallback: the point of this
  // function is that a malformed colour can never reach the stylesheet.
  it.each([
    ['a valid 6-digit hex', '#ff0000', '#ff0000'],
    ['a valid 3-digit hex', '#f0f', '#f0f'],
    ['uppercase hex is preserved verbatim', '#ABCDEF', '#ABCDEF'],
    ['a non-hex word', 'not-a-color', DEFAULT_ACCENT],
    ['a css colour name', 'red', DEFAULT_ACCENT],
    ['hex digits after a bad hash', '#xyz', DEFAULT_ACCENT],
    ['an empty string', '', DEFAULT_ACCENT],
    ['an undefined value', undefined, DEFAULT_ACCENT],
    ['hex without the leading hash', 'ff0000', DEFAULT_ACCENT],
    ['a hex longer than 6 digits', '#1234567', DEFAULT_ACCENT]
  ])('safeAiAccentColor on %s', (_case, input, expected) => {
    expect(safeAiAccentColor(input)).toBe(expected)
  })
})

describe('mergeOrderedIds', () => {
  // Ordering is the whole contract here: ids already in `previous` keep their
  // old slot, new ids append in `next` order, dropped ids disappear.
  it.each([
    ['an identical list keeps its order', ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c']],
    ['new items append to the end', ['a', 'b'], ['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd']],
    ['items missing from next are removed', ['a', 'b', 'c'], ['a', 'c'], ['a', 'c']],
    ['an empty previous takes everything', [], ['a', 'b'], ['a', 'b']],
    ['an empty next drops everything', ['a', 'b'], [], []],
    ['both empty stays empty', [], [], []],
    ['completely new ids replace the old ones', ['a', 'b'], ['c', 'd'], ['c', 'd']],
    ['previous order wins over next order', ['b', 'a'], ['a', 'b', 'c'], ['b', 'a', 'c']]
  ])('%s', (_case, previous, next, expected) => {
    expect(mergeOrderedIds(previous, next)).toEqual(expected)
  })

  it('returns the same array reference when nothing changes (perf optimization)', () => {
    const previous = ['a', 'b', 'c']
    const next = ['a', 'b', 'c']
    const result = mergeOrderedIds(previous, next)
    // areIdsEqual check causes the function to return the previous reference
    expect(result).toBe(previous)
  })

  it('returns a new reference when the contents change', () => {
    const prev = ['a', 'b']
    const result = mergeOrderedIds(prev, ['a', 'b', 'c'])
    expect(result).not.toBe(prev)
    expect(result).toEqual(['a', 'b', 'c'])
  })
})

describe('getEnabledAiIdsByType', () => {
  const aiSites: AiSiteMap = {
    chatgpt: { isSite: false } as AiPlatform,
    gemini: { isSite: true } as AiPlatform,
    claude: { isSite: false } as AiPlatform,
    youtube: { isSite: true } as AiPlatform,
    unknown: undefined
  }

  it('returns only models (non-site) when tone is "model"', () => {
    const result = getEnabledAiIdsByType(['chatgpt', 'gemini', 'claude'], aiSites, 'model')
    expect(result).toEqual(['chatgpt', 'claude'])
  })

  it('returns only sites (isSite) when tone is "site"', () => {
    const result = getEnabledAiIdsByType(['chatgpt', 'gemini', 'youtube'], aiSites, 'site')
    expect(result).toEqual(['gemini', 'youtube'])
  })

  it('filters out unknown ids (not in aiSites map)', () => {
    const result = getEnabledAiIdsByType(['unknown', 'missing'], aiSites, 'model')
    expect(result).toEqual([])
  })

  it('returns empty for empty enabledModels', () => {
    const result = getEnabledAiIdsByType([], aiSites, 'model')
    expect(result).toEqual([])
  })

  it('returns empty for empty aiSites', () => {
    const result = getEnabledAiIdsByType(['chatgpt'], {}, 'model')
    expect(result).toEqual([])
  })

  it('preserves the input order of enabledModels', () => {
    const sites: Record<string, AiPlatform> = {
      a: makeSite('a'),
      b: makeSite('b'),
      c: makeSite('c')
    }
    const result = getEnabledAiIdsByType(['c', 'a', 'b'], sites, 'model')
    expect(result).toEqual(['c', 'a', 'b'])
  })
})

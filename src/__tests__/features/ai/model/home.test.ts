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
  it('returns valid 6-digit hex color', () => {
    expect(safeAiAccentColor('#ff0000')).toBe('#ff0000')
  })

  it('returns valid 3-digit hex color', () => {
    expect(safeAiAccentColor('#f0f')).toBe('#f0f')
    expect(safeAiAccentColor('#FFF')).toBe('#FFF')
  })

  it('returns default for invalid hex', () => {
    expect(safeAiAccentColor('not-a-color')).toBe('#6ee7b7')
    expect(safeAiAccentColor('red')).toBe('#6ee7b7')
    expect(safeAiAccentColor('#xyz')).toBe('#6ee7b7')
  })

  it('returns default for empty string', () => {
    expect(safeAiAccentColor('')).toBe('#6ee7b7')
  })

  it('returns default for undefined', () => {
    expect(safeAiAccentColor()).toBe('#6ee7b7')
  })

  it('returns default for hex without #', () => {
    expect(safeAiAccentColor('ff0000')).toBe('#6ee7b7')
  })

  it('returns default for too long hex', () => {
    expect(safeAiAccentColor('#1234567')).toBe('#6ee7b7')
  })

  it('accepts case-insensitive hex', () => {
    expect(safeAiAccentColor('#ABCDEF')).toBe('#ABCDEF')
    expect(safeAiAccentColor('#abcdef')).toBe('#abcdef')
  })
})

describe('mergeOrderedIds', () => {
  it('preserves the order of items that are in both lists', () => {
    const previous = ['a', 'b', 'c']
    const next = ['a', 'b', 'c']
    expect(mergeOrderedIds(previous, next)).toEqual(['a', 'b', 'c'])
  })

  it('appends new items to the end', () => {
    const previous = ['a', 'b']
    const next = ['a', 'b', 'c', 'd']
    expect(mergeOrderedIds(previous, next)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('removes items that are no longer in next', () => {
    const previous = ['a', 'b', 'c']
    const next = ['a', 'c']
    expect(mergeOrderedIds(previous, next)).toEqual(['a', 'c'])
  })

  it('returns the same array reference when nothing changes (perf optimization)', () => {
    const previous = ['a', 'b', 'c']
    const next = ['a', 'b', 'c']
    const result = mergeOrderedIds(previous, next)
    // areIdsEqual check causes the function to return the previous reference
    expect(result).toBe(previous)
  })

  it('returns new reference when items change', () => {
    const prev = ['a', 'b']
    const result = mergeOrderedIds(prev, ['a', 'b', 'c'])
    expect(result).not.toBe(prev)
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('handles empty previous', () => {
    expect(mergeOrderedIds([], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('handles empty next', () => {
    expect(mergeOrderedIds(['a', 'b'], [])).toEqual([])
  })

  it('handles both empty', () => {
    expect(mergeOrderedIds([], [])).toEqual([])
  })

  it('handles completely new ids', () => {
    const result = mergeOrderedIds(['a', 'b'], ['c', 'd'])
    expect(result).toEqual(['c', 'd'])
  })

  it('preserves previous order even when next has different order', () => {
    // We keep the order of items that are already in `previous`,
    // and append new items in the order they appear in `next`.
    const previous = ['b', 'a']
    const next = ['a', 'b', 'c']
    expect(mergeOrderedIds(previous, next)).toEqual(['b', 'a', 'c'])
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

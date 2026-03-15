import { describe, expect, it } from 'vitest'
import {
  getEnabledAiIdsByType,
  getFeaturedAiIds,
  mergeOrderedIds,
  safeAiAccentColor
} from '@features/ai/model/home'

describe('ai home model helpers', () => {
  it('falls back to the default accent color for invalid colors', () => {
    expect(safeAiAccentColor(undefined)).toBe('#6ee7b7')
    expect(safeAiAccentColor('red')).toBe('#6ee7b7')
    expect(safeAiAccentColor('#123abc')).toBe('#123abc')
  })

  it('preserves previous order while appending new ids', () => {
    expect(mergeOrderedIds(['b', 'a'], ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
    expect(mergeOrderedIds(['a', 'b'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('filters enabled ids by site type and builds featured ids', () => {
    const aiSites = {
      modelA: { id: 'modelA', name: 'Model A', url: 'https://model-a.test', isSite: false },
      modelB: { id: 'modelB', name: 'Model B', url: 'https://model-b.test', isSite: false },
      siteA: { id: 'siteA', name: 'Site A', url: 'https://site-a.test', isSite: true },
      siteB: { id: 'siteB', name: 'Site B', url: 'https://site-b.test', isSite: true }
    }

    expect(getEnabledAiIdsByType(['modelA', 'siteA', 'modelB'], aiSites, 'model')).toEqual([
      'modelA',
      'modelB'
    ])
    expect(getEnabledAiIdsByType(['modelA', 'siteA', 'siteB'], aiSites, 'site')).toEqual([
      'siteA',
      'siteB'
    ])
    expect(getFeaturedAiIds(['m1', 'm2', 'm3', 'm4'], ['s1', 's2', 's3'])).toEqual([
      'm1',
      'm2',
      'm3',
      's1',
      's2'
    ])
  })
})

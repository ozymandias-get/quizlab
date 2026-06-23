/**
 * Tests for tabUtils — pure helpers used by useAiTabs.
 * Critical for tab state correctness.
 */
import {
  arePinnedTabsEqual,
  areStringArraysEqual,
  normalizeTitle,
  sanitizePinnedTabs
} from '@app/providers/ai/tabUtils'

import { describe, expect, it } from 'vitest'

describe('normalizeTitle', () => {
  it('returns undefined for undefined', () => {
    expect(normalizeTitle(undefined)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(normalizeTitle('')).toBeUndefined()
  })

  it('returns undefined for whitespace-only string', () => {
    expect(normalizeTitle('   ')).toBeUndefined()
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeTitle('  Hello  ')).toBe('Hello')
  })

  it('keeps internal whitespace', () => {
    expect(normalizeTitle('  Hello   World  ')).toBe('Hello   World')
  })

  it('returns the same string when no whitespace', () => {
    expect(normalizeTitle('Hello')).toBe('Hello')
  })
})

describe('sanitizePinnedTabs', () => {
  const validIds = ['gpt', 'claude', 'gemini']

  it('returns empty array when input is not an array', () => {
    expect(sanitizePinnedTabs(null, validIds)).toEqual([])
    expect(sanitizePinnedTabs(undefined, validIds)).toEqual([])
    expect(sanitizePinnedTabs('not array', validIds)).toEqual([])
    expect(sanitizePinnedTabs(42, validIds)).toEqual([])
    expect(sanitizePinnedTabs({}, validIds)).toEqual([])
  })

  it('returns empty array for empty input', () => {
    expect(sanitizePinnedTabs([], validIds)).toEqual([])
  })

  it('filters out tabs with non-string id', () => {
    const result = sanitizePinnedTabs(
      [
        { id: null, modelId: 'gpt' },
        { id: 42, modelId: 'gpt' },
        { id: 'valid', modelId: 'gpt' }
      ],
      validIds
    )
    expect(result).toEqual([{ id: 'valid', modelId: 'gpt', title: undefined }])
  })

  it('filters out tabs with non-string modelId', () => {
    const result = sanitizePinnedTabs(
      [
        { id: 'a', modelId: null },
        { id: 'b', modelId: 42 },
        { id: 'c', modelId: 'gpt' }
      ],
      validIds
    )
    expect(result).toEqual([{ id: 'c', modelId: 'gpt', title: undefined }])
  })

  it('filters out tabs with invalid modelId', () => {
    const result = sanitizePinnedTabs(
      [
        { id: 'a', modelId: 'unknown' },
        { id: 'b', modelId: 'gpt' }
      ],
      validIds
    )
    expect(result).toEqual([{ id: 'b', modelId: 'gpt', title: undefined }])
  })

  it('deduplicates by id', () => {
    const result = sanitizePinnedTabs(
      [
        { id: 'dup', modelId: 'gpt' },
        { id: 'dup', modelId: 'claude' }
      ],
      validIds
    )
    expect(result).toEqual([{ id: 'dup', modelId: 'gpt', title: undefined }])
  })

  it('trims id and modelId whitespace', () => {
    const result = sanitizePinnedTabs([{ id: '  abc  ', modelId: '  gpt  ' }], validIds)
    expect(result).toEqual([{ id: 'abc', modelId: 'gpt', title: undefined }])
  })

  it('preserves normalized title', () => {
    const result = sanitizePinnedTabs([{ id: 'a', modelId: 'gpt', title: '  My Tab  ' }], validIds)
    expect(result).toEqual([{ id: 'a', modelId: 'gpt', title: 'My Tab' }])
  })

  it('skips null and primitive entries', () => {
    const result = sanitizePinnedTabs(
      [null, 'string', 42, undefined, false, { id: 'a', modelId: 'gpt' }],
      validIds
    )
    expect(result).toEqual([{ id: 'a', modelId: 'gpt', title: undefined }])
  })
})

describe('arePinnedTabsEqual', () => {
  it('returns true for two empty arrays', () => {
    expect(arePinnedTabsEqual([], [])).toBe(true)
  })

  it('returns false for arrays of different lengths', () => {
    expect(arePinnedTabsEqual([{ id: 'a', modelId: 'gpt' }], [])).toBe(false)
  })

  it('returns true for equal arrays', () => {
    const a = [
      { id: 'a', modelId: 'gpt' },
      { id: 'b', modelId: 'claude' }
    ]
    const b = [
      { id: 'a', modelId: 'gpt' },
      { id: 'b', modelId: 'claude' }
    ]
    expect(arePinnedTabsEqual(a, b)).toBe(true)
  })

  it('returns false when id differs', () => {
    expect(arePinnedTabsEqual([{ id: 'a', modelId: 'gpt' }], [{ id: 'b', modelId: 'gpt' }])).toBe(
      false
    )
  })

  it('returns false when modelId differs', () => {
    expect(
      arePinnedTabsEqual([{ id: 'a', modelId: 'gpt' }], [{ id: 'a', modelId: 'claude' }])
    ).toBe(false)
  })

  it('compares normalized titles', () => {
    expect(
      arePinnedTabsEqual(
        [{ id: 'a', modelId: 'gpt', title: '  Tab  ' }],
        [{ id: 'a', modelId: 'gpt', title: 'Tab' }]
      )
    ).toBe(true)
  })

  it('returns false when title differs', () => {
    expect(
      arePinnedTabsEqual(
        [{ id: 'a', modelId: 'gpt', title: 'A' }],
        [{ id: 'a', modelId: 'gpt', title: 'B' }]
      )
    ).toBe(false)
  })
})

describe('areStringArraysEqual', () => {
  it('returns true for two empty arrays', () => {
    expect(areStringArraysEqual([], [])).toBe(true)
  })

  it('returns false for different lengths', () => {
    expect(areStringArraysEqual(['a'], [])).toBe(false)
  })

  it('returns true for same elements in same order', () => {
    expect(areStringArraysEqual(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true)
  })

  it('returns false for different order', () => {
    expect(areStringArraysEqual(['a', 'b'], ['b', 'a'])).toBe(false)
  })

  it('returns false for different content', () => {
    expect(areStringArraysEqual(['a'], ['b'])).toBe(false)
  })
})

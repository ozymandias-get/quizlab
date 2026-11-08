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
  it.each([undefined, '', '   '])('returns undefined for the blank input %j', (input) => {
    expect(normalizeTitle(input)).toBeUndefined()
  })

  it.each([
    ['  Hello  ', 'Hello'],
    ['  Hello   World  ', 'Hello   World'],
    ['Hello', 'Hello']
  ])('trims the outside of %j without touching the inside', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected)
  })
})

describe('sanitizePinnedTabs', () => {
  const validIds = ['gpt', 'claude', 'gemini']

  it.each([null, undefined, 'not array', 42, {}, []])(
    'returns an empty array for the unusable input %j',
    (input) => {
      expect(sanitizePinnedTabs(input as never, validIds)).toEqual([])
    }
  )

  // Sekiz ayrı "bir alan geçersiz" testi tek bir tablo haline gelir: girdi ve
  // kalan tek geçerli sekme birlikte verilir.
  it.each([
    [
      'a non-string id',
      [
        { id: null, modelId: 'gpt' },
        { id: 42, modelId: 'gpt' },
        { id: 'valid', modelId: 'gpt' }
      ],
      { id: 'valid', modelId: 'gpt', title: undefined }
    ],
    [
      'a non-string modelId',
      [
        { id: 'a', modelId: null },
        { id: 'b', modelId: 42 },
        { id: 'c', modelId: 'gpt' }
      ],
      { id: 'c', modelId: 'gpt', title: undefined }
    ],
    [
      'an unknown modelId',
      [
        { id: 'a', modelId: 'unknown' },
        { id: 'b', modelId: 'gpt' }
      ],
      { id: 'b', modelId: 'gpt', title: undefined }
    ],
    [
      'a duplicate id',
      [
        { id: 'dup', modelId: 'gpt' },
        { id: 'dup', modelId: 'claude' }
      ],
      { id: 'dup', modelId: 'gpt', title: undefined }
    ],
    [
      'surrounding whitespace',
      [{ id: '  abc  ', modelId: '  gpt  ' }],
      { id: 'abc', modelId: 'gpt', title: undefined }
    ],
    [
      'null and primitive entries',
      [null, 'string', 42, undefined, false, { id: 'a', modelId: 'gpt' }],
      { id: 'a', modelId: 'gpt', title: undefined }
    ]
  ] as const)('drops the entry with %s and keeps the rest', (_label, input, expected) => {
    expect(sanitizePinnedTabs(input as never, validIds)).toEqual([expected])
  })

  it('preserves a normalized title', () => {
    const result = sanitizePinnedTabs([{ id: 'a', modelId: 'gpt', title: '  My Tab  ' }], validIds)
    expect(result).toEqual([{ id: 'a', modelId: 'gpt', title: 'My Tab' }])
  })
})

describe('arePinnedTabsEqual', () => {
  const tab = (over: Record<string, unknown> = {}) => ({ id: 'a', modelId: 'gpt', ...over })

  it.each([
    ['two empty arrays', [], [], true],
    [
      'equal arrays',
      [tab(), tab({ id: 'b', modelId: 'claude' })],
      [tab(), tab({ id: 'b', modelId: 'claude' })],
      true
    ],
    ['normalized titles', [tab({ title: '  Tab  ' })], [tab({ title: 'Tab' })], true],
    ['different lengths', [tab()], [], false],
    ['a different id', [tab()], [tab({ id: 'b' })], false],
    ['a different modelId', [tab()], [tab({ modelId: 'claude' })], false],
    ['a different title', [tab({ title: 'A' })], [tab({ title: 'B' })], false]
  ] as const)('compares %s', (_label, a, b, expected) => {
    expect(arePinnedTabsEqual(a as never, b as never)).toBe(expected)
  })
})

describe('areStringArraysEqual', () => {
  // `as const` would freeze the rows into readonly tuples, which the helper's
  // `string[]` signature cannot take, so the row type is declared to match it:
  // the label stays a literal in the test title, the arrays stay mutable.
  it.each<[string, string[], string[], boolean]>([
    ['two empty arrays', [], [], true],
    ['same elements in the same order', ['a', 'b', 'c'], ['a', 'b', 'c'], true],
    ['different lengths', ['a'], [], false],
    ['different order', ['a', 'b'], ['b', 'a'], false],
    ['different content', ['a'], ['b'], false]
  ])('compares %s', (_label, a, b, expected) => {
    expect(areStringArraysEqual(a, b)).toBe(expected)
  })
})

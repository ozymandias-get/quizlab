/**
 * Tests for src/features/settings/ui/selectors/selectorUtils.ts —
 * pure utility functions used by the Settings → Selectors UI to find
 * and inspect automation configs.
 */
import type { AiSelectorConfig } from '@shared-core/types'

import { describe, expect, it } from 'vitest'

import {
  hasSelectorLocator,
  normalizeSelectorsData
} from '../../../../features/settings/ui/selectors/selectorUtils'

describe('normalizeSelectorsData', () => {
  it('returns an empty map for anything that is not already a hostname-keyed record', () => {
    expect(normalizeSelectorsData(null)).toEqual({})
    expect(normalizeSelectorsData(undefined)).toEqual({})
    // A bare config (it has an `input` key) is the legacy shape and is not a map.
    expect(normalizeSelectorsData({ input: '#prompt' } as AiSelectorConfig)).toEqual({})
  })

  it('passes a hostname-keyed record through by reference', () => {
    const record: Record<string, AiSelectorConfig> = {
      'example.com': { input: '#prompt' },
      'foo.com': { input: 'textarea' }
    }
    expect(normalizeSelectorsData(record)).toBe(record)
  })
})

describe('hasSelectorLocator', () => {
  it.each([
    ['input', { input: '#prompt' }],
    ['button', { button: 'button.send' }],
    ['inputCandidates', { inputCandidates: ['#prompt'] }],
    ['buttonCandidates', { buttonCandidates: ['button.send'] }],
    ['inputFingerprint', { inputFingerprint: { tag: 'textarea' } }],
    ['buttonFingerprint', { buttonFingerprint: { tag: 'button' } }]
  ])('accepts a config that carries %s', (_field, config) => {
    expect(hasSelectorLocator(config)).toBe(true)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty config', {}],
    ['empty candidate arrays', { inputCandidates: [], buttonCandidates: [] }],
    ['empty string selectors', { input: '', button: '' }]
  ])('rejects %s', (_label, config) => {
    expect(hasSelectorLocator(config)).toBe(false)
  })
})

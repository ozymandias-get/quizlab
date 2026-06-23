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
  it('returns empty object for null', () => {
    expect(normalizeSelectorsData(null)).toEqual({})
  })

  it('returns empty object for undefined', () => {
    expect(normalizeSelectorsData(undefined)).toEqual({})
  })

  it('returns empty object for a single config (has "input" field)', () => {
    const single: AiSelectorConfig = { input: '#prompt' }
    expect(normalizeSelectorsData(single)).toEqual({})
  })

  it('passes through a hostname-keyed record', () => {
    const record: Record<string, AiSelectorConfig> = {
      'example.com': { input: '#prompt' },
      'foo.com': { input: 'textarea' }
    }
    const result = normalizeSelectorsData(record)
    expect(result).toBe(record) // returns the same reference
  })
})

describe('hasSelectorLocator', () => {
  it('returns false for null / undefined', () => {
    expect(hasSelectorLocator(null)).toBe(false)
    expect(hasSelectorLocator(undefined)).toBe(false)
  })

  it('returns false for an empty config', () => {
    expect(hasSelectorLocator({})).toBe(false)
  })

  it('returns true when input is set', () => {
    expect(hasSelectorLocator({ input: '#prompt' })).toBe(true)
  })

  it('returns true when button is set', () => {
    expect(hasSelectorLocator({ button: 'button.send' })).toBe(true)
  })

  it('returns true when inputCandidates has at least one entry', () => {
    expect(hasSelectorLocator({ inputCandidates: ['#prompt'] })).toBe(true)
  })

  it('returns true when buttonCandidates has at least one entry', () => {
    expect(hasSelectorLocator({ buttonCandidates: ['button.send'] })).toBe(true)
  })

  it('returns true when inputFingerprint is set', () => {
    expect(hasSelectorLocator({ inputFingerprint: { tag: 'textarea' } })).toBe(true)
  })

  it('returns true when buttonFingerprint is set', () => {
    expect(hasSelectorLocator({ buttonFingerprint: { tag: 'button' } })).toBe(true)
  })

  it('returns false for empty candidates arrays', () => {
    expect(hasSelectorLocator({ inputCandidates: [] })).toBe(false)
    expect(hasSelectorLocator({ buttonCandidates: [] })).toBe(false)
  })

  it('returns false for empty string selectors', () => {
    expect(hasSelectorLocator({ input: '', button: '' })).toBe(false)
  })
})

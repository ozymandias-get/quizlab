import type { AiPlatform } from '@shared-core/types'

import {
  isCustomModelPlatform,
  isCustomSitePlatform,
  isManagedGooglePlatform,
  MANAGED_GOOGLE_PLATFORM_IDS
} from '@features/settings/ui/shared/aiPlatformFilters'

import { describe, expect, it } from 'vitest'

const platform = (id: string, isSite: boolean) => ({ id, isSite }) as AiPlatform

/**
 * The product rule these two predicates encode: Google's own apps (Gemini,
 * AI Studio, YouTube) are first-class and are never offered as user-defined
 * "custom" entries, while every other site / model is.
 */
describe('isManagedGooglePlatform', () => {
  it.each([...MANAGED_GOOGLE_PLATFORM_IDS])('treats %s as Google-managed', (id) => {
    expect(isManagedGooglePlatform(id)).toBe(true)
  })

  it.each(['notebooklm', 'openai', 'anthropic', 'custom', ''])(
    'treats %j as not Google-managed',
    (id) => {
      expect(isManagedGooglePlatform(id)).toBe(false)
    }
  )
})

describe('isCustomModelPlatform', () => {
  it.each([
    ['a non-Google model', platform('openai', false), true],
    ['a Google-managed model', platform('gemini', false), false],
    ['a non-Google site', platform('custom-site', true), false],
    ['a Google-managed site', platform('gemini', true), false]
  ])('classifies %s', (_label, candidate, expected) => {
    expect(isCustomModelPlatform(candidate)).toBe(expected)
  })
})

describe('isCustomSitePlatform', () => {
  it.each([
    ['a non-Google site', platform('chatgpt', true), true],
    ['a Google-managed site', platform('gemini', true), false],
    ['a non-Google model', platform('openai', false), false],
    ['a Google-managed model', platform('aistudio', false), false],
    ['an unknown model', platform('unknown', false), false]
  ])('classifies %s', (_label, candidate, expected) => {
    expect(isCustomSitePlatform(candidate)).toBe(expected)
  })
})

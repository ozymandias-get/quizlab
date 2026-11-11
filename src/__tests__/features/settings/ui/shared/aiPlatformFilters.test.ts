import { GOOGLE_WEB_SESSION_REGISTRY_IDS } from '@shared-core/constants/googleAiWebApps'
import type { AiPlatform } from '@shared-core/types'

import { isCustomSitePlatform } from '@features/settings/ui/shared/aiPlatformFilters'

import { describe, expect, it } from 'vitest'

const platform = (id: string, isSite: boolean) => ({ id, isSite }) as AiPlatform

/**
 * The product rule this predicate encodes: Google's own apps (Gemini,
 * AI Studio, YouTube, Drive, NotebookLM) are first-class and are never offered
 * as user-defined "custom" entries, while every other site is.
 */
describe('isCustomSitePlatform', () => {
  it.each([...GOOGLE_WEB_SESSION_REGISTRY_IDS])(
    'does not treat the Google-managed site %s as custom',
    (id) => {
      expect(isCustomSitePlatform(platform(id, true))).toBe(false)
    }
  )

  it.each([
    ['a non-Google site', platform('chatgpt', true), true],
    ['a non-Google model', platform('openai', false), false],
    ['a Google-managed model', platform('aistudio', false), false],
    ['an unknown model', platform('unknown', false), false]
  ])('classifies %s', (_label, candidate, expected) => {
    expect(isCustomSitePlatform(candidate)).toBe(expected)
  })
})

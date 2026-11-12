import { PICKER_TRANSLATION_KEYS } from '@features/automation/lib/automationConstants'
import '@shared/i18n/i18next'

import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(async () => {
  await i18next.changeLanguage('en')
})

describe('PICKER_TRANSLATION_KEYS', () => {
  // These keys are the allow-list `useElementPicker` builds its translation map
  // from before injecting the picker into the guest page (see
  // useElementPicker.ts, `for (const key of PICKER_TRANSLATION_KEYS)`). A key
  // listed here but missing from a shipped locale renders a blank label inside
  // the page the user is clicking on, so both bundles must answer for it.
  it('resolves to a real translation in every shipped language', () => {
    for (const lng of ['en', 'tr'] as const) {
      const bundle = i18next.getResourceBundle(lng, 'translation') as Record<string, unknown>

      for (const key of PICKER_TRANSLATION_KEYS) {
        expect(typeof bundle[key], `${lng} is missing "${key}"`).toBe('string')
      }
    }
  })
})

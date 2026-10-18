import {
  PICKER_SCRIPTS,
  PICKER_TIMING,
  PICKER_TRANSLATION_KEYS
} from '@features/automation/lib/automationConstants'
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

  // The array is append-only; a duplicated entry silently overwrites its own
  // translation and shifts every later label.
  it('lists every key exactly once', () => {
    const unique = new Set(PICKER_TRANSLATION_KEYS)
    expect(unique.size).toBe(PICKER_TRANSLATION_KEYS.length)
  })
})

describe('PICKER_SCRIPTS', () => {
  // Both strings are handed straight to `executeJavaScript`, so an empty or
  // non-string value would inject nothing and leave the picker overlay stuck.
  it('exposes non-empty injectable source for RESET and CLEANUP', () => {
    for (const [name, script] of Object.entries(PICKER_SCRIPTS)) {
      expect(typeof script, `${name} should be a string`).toBe('string')
      expect(script.length, `${name} should not be empty`).toBeGreaterThan(0)
    }
  })
})

describe('PICKER_TIMING', () => {
  // Every entry feeds a `setTimeout`; a missing or zero value collapses the
  // picker's teardown steps into the same tick.
  it('exposes only positive numeric delays', () => {
    for (const [key, value] of Object.entries(PICKER_TIMING)) {
      expect(typeof value, `${key} should be a number`).toBe('number')
      expect(value, `${key} should be > 0`).toBeGreaterThan(0)
    }
  })
})

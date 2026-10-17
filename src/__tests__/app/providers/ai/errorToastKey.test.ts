/**
 * `toErrorToastKey` turns a machine error code coming back from the send
 * pipelines into an i18n key. ToastItem renders `t(toast.message)`, so if the
 * constructed key is missing from the bundles, i18next hands the key straight
 * back and the user reads a raw slug like "error_teapot" instead of a message.
 *
 * These tests pin that a key the bundles do not know about never reaches the
 * toast layer.
 */
import '@shared/i18n/i18next'

import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

import { toErrorToastKey } from '@app/providers/ai/errorToastKey'

beforeAll(async () => {
  await i18next.changeLanguage('en')
})

describe('toErrorToastKey', () => {
  it('resolves a known code to a translated message', () => {
    const key = toErrorToastKey('wrong_url')
    expect(key).toBe('error_wrong_url')
    expect(i18next.t(key)).not.toBe(key)
  })

  it('falls back to error_unknown_error for a code with no translation', () => {
    // A code added to a send pipeline without a bundles entry would otherwise
    // render verbatim in the toast.
    const key = toErrorToastKey('teapot')
    expect(i18next.t(key)).not.toBe(key)
  })

  it('falls back for codes with no translation in the active language', () => {
    void i18next.changeLanguage('tr')
    try {
      const key = toErrorToastKey('teapot')
      expect(i18next.t(key)).not.toBe(key)
    } finally {
      void i18next.changeLanguage('en')
    }
  })

  it.each([[undefined], [''], ['   '], ['!!!'], ['---']])(
    'falls back for the unusable input %j',
    (input) => {
      const key = toErrorToastKey(input)
      expect(key).toBe('error_unknown_error')
    }
  )

  it('slugifies mixed case and spaces', () => {
    expect(toErrorToastKey('Webview Not Ready')).toBe('error_webview_not_ready')
  })
})

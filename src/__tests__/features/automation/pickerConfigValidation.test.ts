import { isPickerConfig } from '@features/automation/hooks/elementPickerUtils'

import { describe, expect, it } from 'vitest'

describe('isPickerConfig target validation (T16)', () => {
  it('T16: accepts a complete locator bundle payload', () => {
    expect(
      isPickerConfig({
        version: 2,
        input: 'textarea[placeholder="Ask"]',
        button: 'button[aria-label="Send"]',
        inputFingerprint: { tag: 'textarea' },
        buttonFingerprint: { tag: 'button' }
      })
    ).toBe(true)
  })

  it('T16: rejects a payload with fingerprints but no persisted selectors', () => {
    expect(
      isPickerConfig({
        version: 2,
        inputFingerprint: { tag: 'textarea' },
        buttonFingerprint: { tag: 'button' }
      })
    ).toBe(false)
  })

  it('T16: rejects null/empty selectors pointing at no target', () => {
    expect(
      isPickerConfig({
        version: 2,
        input: null,
        button: null,
        inputFingerprint: { tag: 'textarea' },
        buttonFingerprint: { tag: 'button' }
      })
    ).toBe(false)

    expect(
      isPickerConfig({
        version: 2,
        input: '',
        button: 'button',
        inputFingerprint: { tag: 'textarea' },
        buttonFingerprint: { tag: 'button' }
      })
    ).toBe(false)
  })

  it('T16: rejects malformed fingerprints with no element identity', () => {
    expect(
      isPickerConfig({
        version: 2,
        input: 'textarea',
        button: 'button',
        inputFingerprint: {},
        buttonFingerprint: { tag: 'button' }
      })
    ).toBe(false)
  })
})

import { toStrictBoolean } from '@electron/core/ipcPayloadGuards'

import { describe, expect, it } from 'vitest'

// `toStrictBoolean` is a strict `value === true`. The eleven one-value tests
// this replaced only restated that implementation back to it — the truth table
// has exactly two rows, so it is asserted as two rows.
describe('toStrictBoolean', () => {
  it('returns true for the literal true', () => {
    expect(toStrictBoolean(true)).toBe(true)
  })

  it('returns false for everything that is not the literal true', () => {
    const notTrue: unknown[] = ['true', 'false', 1, 0, null, undefined, '', {}, [], 'TRUE']
    for (const value of notTrue) {
      expect(toStrictBoolean(value)).toBe(false)
    }
  })
})

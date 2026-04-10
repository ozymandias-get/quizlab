import { describe, expect, it } from 'vitest'
import { toStrictBoolean } from '../../core/ipcPayloadGuards'

describe('ipcPayloadGuards', () => {
  it('toStrictBoolean only accepts true and false', () => {
    expect(toStrictBoolean(true)).toBe(true)
    expect(toStrictBoolean(false)).toBe(false)
    expect(toStrictBoolean('false')).toBe(false)
    expect(toStrictBoolean('true')).toBe(false)
    expect(toStrictBoolean(1)).toBe(false)
    expect(toStrictBoolean(0)).toBe(false)
    expect(toStrictBoolean(null)).toBe(false)
    expect(toStrictBoolean(undefined)).toBe(false)
  })
})

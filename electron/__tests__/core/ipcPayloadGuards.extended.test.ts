import { toStrictBoolean } from '@electron/core/ipcPayloadGuards'

import { describe, expect, it, vi } from 'vitest'

describe('toStrictBoolean', () => {
  it('returns true for literal true', () => {
    expect(toStrictBoolean(true)).toBe(true)
  })

  it('returns false for literal false', () => {
    expect(toStrictBoolean(false)).toBe(false)
  })

  it('returns false for string "true"', () => {
    expect(toStrictBoolean('true')).toBe(false)
  })

  it('returns false for string "false"', () => {
    expect(toStrictBoolean('false')).toBe(false)
  })

  it('returns false for number 1', () => {
    expect(toStrictBoolean(1)).toBe(false)
  })

  it('returns false for number 0', () => {
    expect(toStrictBoolean(0)).toBe(false)
  })

  it('returns false for null', () => {
    expect(toStrictBoolean(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(toStrictBoolean(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(toStrictBoolean('')).toBe(false)
  })

  it('returns false for object', () => {
    expect(toStrictBoolean({})).toBe(false)
  })

  it('returns false for array', () => {
    expect(toStrictBoolean([])).toBe(false)
  })
})

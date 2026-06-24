import { createHash } from 'crypto'
import { describe, expect, it } from 'vitest'

import {
  computeGoogleAccountHash,
  GOOGLE_ACCOUNT_HASH_COOKIE_NAMES,
  isProcessAlive,
  nowIso
} from '../../../features/gemini-web-session/sessionUtils.js'

function expectedHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

describe('nowIso', () => {
  it('returns an ISO 8601 string', () => {
    const result = nowIso()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})

describe('isProcessAlive', () => {
  it('returns true for the current process', () => {
    expect(isProcessAlive(process.pid)).toBe(true)
  })

  it('returns false for a non-existent PID', () => {
    expect(isProcessAlive(999999999)).toBe(false)
  })

  it('returns false for non-positive PID', () => {
    expect(isProcessAlive(0)).toBe(false)
    expect(isProcessAlive(-1)).toBe(false)
  })

  it('returns false for non-integer values', () => {
    expect(isProcessAlive(1.5)).toBe(false)
  })
})

describe('computeGoogleAccountHash', () => {
  it('computes hash from __Secure-1PSID with google.com domain', () => {
    const cookies = [{ name: '__Secure-1PSID', value: 'abc123', domain: 'google.com' }]
    const hash = computeGoogleAccountHash(cookies)
    expect(hash).toBe(expectedHash('abc123'))
  })

  it('falls back to SID when __Secure-1PSID is missing', () => {
    const cookies = [{ name: 'SID', value: 'def456', domain: 'google.com' }]
    const hash = computeGoogleAccountHash(cookies)
    expect(hash).toBe(expectedHash('def456'))
  })

  it('falls back to SAPISID when others are missing', () => {
    const cookies = [{ name: 'SAPISID', value: 'ghi789', domain: 'google.com' }]
    const hash = computeGoogleAccountHash(cookies)
    expect(hash).toBe(expectedHash('ghi789'))
  })

  it('returns null when no matching cookies exist', () => {
    expect(computeGoogleAccountHash([])).toBeNull()
  })

  it('returns null when cookie has no value', () => {
    const cookies = [{ name: '__Secure-1PSID', domain: 'google.com' }]
    expect(computeGoogleAccountHash(cookies)).toBeNull()
  })

  it('ignores cookies without google.com domain', () => {
    const cookies = [{ name: '__Secure-1PSID', value: 'abc', domain: 'example.com' }]
    expect(computeGoogleAccountHash(cookies)).toBeNull()
  })

  it('prefers __Secure-1PSID over SID and SAPISID', () => {
    const cookies = [
      { name: 'SAPISID', value: 'first', domain: 'google.com' },
      { name: '__Secure-1PSID', value: 'second', domain: 'google.com' },
      { name: 'SID', value: 'third', domain: 'google.com' }
    ]
    const hash = computeGoogleAccountHash(cookies)
    expect(hash).toBe(expectedHash('second'))
  })

  it('uses correct cookie name constants', () => {
    expect(GOOGLE_ACCOUNT_HASH_COOKIE_NAMES).toEqual(['__Secure-1PSID', 'SID', 'SAPISID'])
  })
})

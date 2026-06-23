import { isReasonCode, isSessionState } from '@electron/features/gemini-web-session/sessionConfig'

import { describe, expect, it } from 'vitest'

describe('isSessionState', () => {
  it('should return true for all valid states', () => {
    expect(isSessionState('uninitialized')).toBe(true)
    expect(isSessionState('auth_required')).toBe(true)
    expect(isSessionState('authenticated')).toBe(true)
    expect(isSessionState('degraded')).toBe(true)
    expect(isSessionState('reauth_required')).toBe(true)
  })

  it('should return false for invalid states', () => {
    expect(isSessionState('invalid')).toBe(false)
    expect(isSessionState('')).toBe(false)
    expect(isSessionState('UNINITIALIZED')).toBe(false)
  })
})

describe('isReasonCode', () => {
  it('should return true for all valid reason codes', () => {
    expect(isReasonCode('none')).toBe(true)
    expect(isReasonCode('login_redirect')).toBe(true)
    expect(isReasonCode('challenge')).toBe(true)
    expect(isReasonCode('network')).toBe(true)
    expect(isReasonCode('unknown')).toBe(true)
    expect(isReasonCode('reset_profile_required')).toBe(true)
  })

  it('should return false for invalid reason codes', () => {
    expect(isReasonCode('invalid')).toBe(false)
    expect(isReasonCode('')).toBe(false)
    expect(isReasonCode('NONE')).toBe(false)
  })
})

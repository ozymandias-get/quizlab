import { describe, expect, it } from 'vitest'

import { generateCspNonce, getDevCsp, getStrictCsp } from '../../core/csp.js'

describe('generateCspNonce', () => {
  it('returns a base64 string', () => {
    const nonce = generateCspNonce()
    expect(nonce).toBeTruthy()
    expect(() => Buffer.from(nonce, 'base64')).not.toThrow()
  })

  it('returns different values on each call', () => {
    const a = generateCspNonce()
    const b = generateCspNonce()
    expect(a).not.toBe(b)
  })

  it('produces 16 bytes of randomness (base64 encoded)', () => {
    const nonce = generateCspNonce()
    const decoded = Buffer.from(nonce, 'base64')
    expect(decoded.length).toBe(16)
  })
})

describe('getStrictCsp', () => {
  it('includes the nonce in script-src', () => {
    const nonce = 'test-nonce-value'
    const csp = getStrictCsp(nonce)
    expect(csp).toContain(`'nonce-${nonce}'`)
  })

  it('includes default-src with self and blob', () => {
    const csp = getStrictCsp('abc')
    expect(csp).toContain("default-src 'self' blob: local-pdf:")
  })

  it('includes frame-src with gemini.google.com', () => {
    const csp = getStrictCsp('abc')
    expect(csp).toContain('gemini.google.com')
  })

  it('does not contain unsafe-inline in script-src', () => {
    const csp = getStrictCsp('abc')
    const scriptSrc = csp.split(';').find((s) => s.trim().startsWith('script-src'))
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })
})

describe('getDevCsp', () => {
  it('contains unsafe-inline in script-src', () => {
    const csp = getDevCsp()
    expect(csp).toContain("'unsafe-inline'")
  })

  it('contains default-src with self and blob', () => {
    const csp = getDevCsp()
    expect(csp).toContain("default-src 'self' blob: local-pdf:")
  })

  it('contains frame-src with gemini.google.com', () => {
    const csp = getDevCsp()
    expect(csp).toContain('gemini.google.com')
  })
})

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

// The production and development policies differ in exactly one directive.
// Everything else — default-src, frame-src, connect-src — was asserted with
// byte-identical strings in both blocks, so it is asserted once per builder
// here and the script-src difference is a separate case.
const builders = [
  ['getStrictCsp', () => getStrictCsp('abc')],
  ['getDevCsp', () => getDevCsp()]
] as const

describe('CSP builders', () => {
  it.each(builders)('%s includes default-src with self and blob', (_name, build) => {
    expect(build()).toContain("default-src 'self' blob: local-pdf:")
  })

  it.each(builders)('%s includes frame-src with gemini.google.com', (_name, build) => {
    expect(build()).toContain('gemini.google.com')
  })

  it.each(builders)('%s keeps connect-src limited to the PDF pipeline', (_name, build) => {
    const connectSrc = build()
      .split(';')
      .find((s) => s.trim().startsWith('connect-src'))
    expect(connectSrc).toContain('local-pdf:')
    expect(connectSrc).not.toContain('local-ocr:')
    expect(connectSrc).not.toContain('https://cdn.jsdelivr.net')
  })
})

describe('getStrictCsp', () => {
  it('includes the nonce in script-src and forbids unsafe-inline there', () => {
    const nonce = 'test-nonce-value'
    const csp = getStrictCsp(nonce)
    expect(csp).toContain(`'nonce-${nonce}'`)

    const scriptSrc = csp.split(';').find((s) => s.trim().startsWith('script-src'))
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })
})

describe('getDevCsp', () => {
  it('relaxes script-src with unsafe-inline for the dev server', () => {
    expect(getDevCsp()).toContain("'unsafe-inline'")
  })
})

import { resolveExternalLink } from '@electron/core/systemHandlers/externalLinkPolicy'

import { describe, expect, it } from 'vitest'

describe('resolveExternalLink', () => {
  it('opens an ordinary https URL, normalized through the URL parser', () => {
    expect(resolveExternalLink('https://example.com')).toEqual({
      allowed: true,
      url: 'https://example.com/'
    })
    expect(resolveExternalLink('https://example.com/a/b?x=1#y')).toEqual({
      allowed: true,
      url: 'https://example.com/a/b?x=1#y'
    })
  })

  it('opens mailto links', () => {
    expect(resolveExternalLink('mailto:someone@example.com')).toEqual({
      allowed: true,
      url: 'mailto:someone@example.com'
    })
  })

  it.each([
    ['not a url at all'],
    ['file:///secret'],
    ['javascript:alert(1)'],
    ['http://example.com'],
    ['ftp://example.com'],
    ['data:text/html,<script>x</script>']
  ])('refuses %s', (url) => {
    expect(resolveExternalLink(url).allowed).toBe(false)
  })

  it('refuses embedded credentials', () => {
    expect(resolveExternalLink('https://user:pass@example.com').allowed).toBe(false)
    expect(resolveExternalLink('https://user@example.com').allowed).toBe(false)
  })

  it('refuses a protocol-relative URL, which would inherit our own scheme', () => {
    expect(resolveExternalLink('//example.com').allowed).toBe(false)
  })

  it('refuses control characters that can smuggle a second line', () => {
    expect(resolveExternalLink('https://example.com/\u0000\u001b[2J').allowed).toBe(false)
    expect(resolveExternalLink('https://exa\u007fmple.com').allowed).toBe(false)
  })

  it('refuses hosts that address the local machine rather than the internet', () => {
    expect(resolveExternalLink('https://127.0.0.1').allowed).toBe(false)
    expect(resolveExternalLink('https://localhost').allowed).toBe(false)
    expect(resolveExternalLink('https://[::1]/').allowed).toBe(false)
    expect(resolveExternalLink('https://intranet').allowed).toBe(false)
  })

  it('requires the raw string to carry a lowercase scheme prefix', () => {
    // The parser normalizes `HTTPS:` to `https:`, but the raw-prefix guard keeps
    // the rule anchored to what the caller literally typed.
    expect(resolveExternalLink('HTTPS://example.com').allowed).toBe(false)
  })

  it('reports an unparsable URL separately from an ordinary policy rejection', () => {
    const decision = resolveExternalLink('not a url at all')
    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toBe('unparsable')

    const rejected = resolveExternalLink('file:///secret')
    expect(rejected.allowed === false && rejected.reason).toBe('rejected')
  })

  it.each([[undefined], [null], [''], [42], [{}]])('refuses the non-string input %s', (url) => {
    const decision = resolveExternalLink(url)
    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toBe('rejected')
  })
})

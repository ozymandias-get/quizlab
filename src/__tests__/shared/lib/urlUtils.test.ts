import { parseUrlWithAllowedProtocols } from '@shared/lib/urlUtils'

import { describe, expect, it } from 'vitest'

const HTTP_HTTPS = ['http:', 'https:'] as const

// This is the renderer-side half of the external-link policy: the main process
// re-validates, but a URL that never leaves the renderer as a URL must not be
// one the renderer would have handed over in the first place.
describe('parseUrlWithAllowedProtocols', () => {
  it.each([
    ['https://example.com/path', true],
    ['http://example.com', true],
    ['  https://example.com  ', true]
  ])('accepts %j', (input, accepted) => {
    const result = parseUrlWithAllowedProtocols(input, HTTP_HTTPS)
    expect(result).toBeInstanceOf(URL)
    if (accepted) expect(result!.hostname).toContain('example.com')
  })

  it.each(['ftp://example.com', 'javascript:alert(1)', 'data:text/html,<script>', 'not a url', ''])(
    'refuses %j',
    (input) => {
      expect(parseUrlWithAllowedProtocols(input, HTTP_HTTPS)).toBeNull()
    }
  )
})

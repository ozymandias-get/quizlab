import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchWithSsrProtection,
  validateProviderUrl
} from '../../../../features/ai/apiChatHandlers/ssrf.js'

const realFetch = globalThis.fetch

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  globalThis.fetch = realFetch
})

describe('validateProviderUrl (SSRF Protection)', () => {
  it('allows HTTPS URLs to public hosts', () => {
    expect(validateProviderUrl('https://api.openai.com')).toBeNull()
    expect(validateProviderUrl('https://api.anthropic.com/v1')).toBeNull()
  })

  it('allows HTTP for localhost', () => {
    expect(validateProviderUrl('http://localhost:11434')).toBeNull()
    expect(validateProviderUrl('http://127.0.0.1:8080')).toBeNull()
  })

  it('rejects empty or missing baseUrl', () => {
    expect(validateProviderUrl('')).toBe('Missing baseUrl')
    expect(validateProviderUrl(null as unknown as string)).toBe('Missing baseUrl')
    expect(validateProviderUrl(undefined as unknown as string)).toBe('Missing baseUrl')
  })

  it('rejects non-HTTP(S) protocols', () => {
    expect(validateProviderUrl('file:///etc/passwd')).toContain('Unsupported protocol')
    expect(validateProviderUrl('ftp://files.example.com')).toContain('Unsupported protocol')
    expect(validateProviderUrl('chrome://settings')).toContain('Unsupported protocol')
  })

  it('rejects non-HTTPS URLs for remote hosts', () => {
    expect(validateProviderUrl('http://api.example.com')).toContain('Non-HTTPS')
    expect(validateProviderUrl('http://192.168.1.1:5000')).toContain('Non-HTTPS')
  })

  it('rejects private IP ranges (SSRF)', () => {
    expect(validateProviderUrl('https://10.0.0.1')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://172.16.0.1')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://172.31.255.255')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://192.168.1.1')).toContain('SSRF blocked')
    // HTTPS on 127.0.0.1 is allowed for local development
    expect(validateProviderUrl('https://127.0.0.1')).toBeNull()
  })

  it('rejects link-local and CGNAT ranges', () => {
    expect(validateProviderUrl('https://169.254.169.254')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://100.64.0.1')).toContain('SSRF blocked')
  })

  it('rejects benchmark/documentation ranges', () => {
    expect(validateProviderUrl('https://198.18.0.1')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://198.19.255.255')).toContain('SSRF blocked')
  })

  it('rejects hostnames without dots as private', () => {
    expect(validateProviderUrl('https://internal')).toContain('SSRF blocked')
    // localhost is explicitly allowed (even over HTTPS) for local development
    expect(validateProviderUrl('https://localhost')).toBeNull()
  })

  it('rejects IPv6 loopback and unspecified addresses', () => {
    expect(validateProviderUrl('https://[::1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[0:0:0:0:0:0:0:1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[::]')).toContain('SSRF blocked')
  })

  it('rejects IPv4-mapped IPv6 forms that point at private addresses', () => {
    expect(validateProviderUrl('https://[::ffff:127.0.0.1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[::ffff:169.254.169.254]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[::ffff:10.0.0.1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[0:0:0:0:0:ffff:7f00:1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[::ffff:7f00:1]')).toContain('SSRF blocked')
  })

  it('rejects IPv4-compatible IPv6 forms that embed a private address', () => {
    expect(validateProviderUrl('https://[::127.0.0.1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[::192.168.1.1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[::a9fe:a9fe]')).toContain('SSRF blocked')
  })

  it('rejects link-local, ULA, multicast, documentation, and transition IPv6', () => {
    expect(validateProviderUrl('https://[fe80::1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[fe80::a9fe:a9fe]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[fc00::1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[fd12:3456::1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[ff02::1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[2001:db8::1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[2001::1]')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[2002::1]')).toContain('SSRF blocked')
  })

  it('rejects credentials (userinfo / @ tricks) in provider URLs', () => {
    expect(validateProviderUrl('https://user:pass@api.openai.com')).toContain('Credentials')
    expect(validateProviderUrl('https://127.0.0.1@evil.com')).toContain('Credentials')
    expect(validateProviderUrl('https://evil.com@127.0.0.1')).toContain('Credentials')
    expect(validateProviderUrl('http://127.0.0.1:8080@169.254.169.254')).toContain('Credentials')
  })

  it('normalizes trailing-dot and exotic IPv4 spellings of localhost', () => {
    // "localhost." resolves exactly like "localhost" and stays inside the
    // explicitly allowed local-development exception.
    expect(validateProviderUrl('https://localhost.')).toBeNull()
    expect(validateProviderUrl('http://localhost.:11434')).toBeNull()
    // Decimal/hex/shorthand IPv4 forms are canonicalized by the WHATWG parser
    // to 127.0.0.1, so they follow the same rules as 127.0.0.1 itself.
    expect(validateProviderUrl('http://2130706433')).toBeNull()
    expect(validateProviderUrl('http://0x7f.0.0.1:8080')).toBeNull()
    // ...and remain blocked when they encode a private range instead.
    expect(validateProviderUrl('https://0x7f000001')).toBeNull()
    expect(validateProviderUrl('https://3232235777')).toContain('SSRF blocked')
  })

  it('cannot be bypassed via port manipulation', () => {
    expect(validateProviderUrl('https://169.254.169.254:8443')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://[::ffff:10.0.0.1]:443')).toContain('SSRF blocked')
    expect(validateProviderUrl('http://10.0.0.1:8080')).toContain('Non-HTTPS')
    expect(validateProviderUrl('http://localhost:11434')).toBeNull()
  })

  it('rejects malformed URLs', () => {
    expect(validateProviderUrl('not a url')).toBe('Invalid URL')
    expect(validateProviderUrl('http://')).toBe('Invalid URL')
  })
})

describe('fetchWithSsrProtection (redirect revalidation)', () => {
  it('blocks redirects to private addresses', async () => {
    const fetchMock = globalThis.fetch as any
    fetchMock.mockImplementation(async () => {
      return { status: 302, headers: { get: () => 'http://169.254.169.254/latest/meta-data' } }
    })
    await expect(fetchWithSsrProtection('https://public.example/start')).rejects.toThrow(
      'SSRF blocked on redirect'
    )
  })

  it('blocks cross-origin redirects even to public HTTPS hosts', async () => {
    const fetchMock = globalThis.fetch as any
    fetchMock.mockImplementation(async () => {
      return { status: 302, headers: { get: () => 'https://evil.example/final' } }
    })
    await expect(fetchWithSsrProtection('https://public.example/start')).rejects.toThrow(
      'Cross-origin redirect blocked'
    )
  })

  it('follows redirects on the same origin', async () => {
    const fetchMock = globalThis.fetch as any
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/start')) {
        return { status: 302, headers: { get: () => 'https://public.example/final' } }
      }
      return { status: 200, ok: true, json: async () => ({ done: true }) }
    })
    const response = await fetchWithSsrProtection('https://public.example/start')
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenLastCalledWith('https://public.example/final', expect.anything())
  })

  it('follows relative redirects on the same origin', async () => {
    const fetchMock = globalThis.fetch as any
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/v1/chat')) {
        return { status: 302, headers: { get: () => '../v2/chat' } }
      }
      return { status: 200, ok: true, json: async () => ({ done: true }) }
    })
    const response = await fetchWithSsrProtection('https://api.example.com/v1/chat')
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/v2/chat', expect.anything())
  })

  it('throws on redirect loops', async () => {
    const fetchMock = globalThis.fetch as any
    fetchMock.mockImplementation(async () => {
      return { status: 308, headers: { get: () => 'https://loop.example.com/again' } }
    })
    await expect(fetchWithSsrProtection('https://loop.example.com/start')).rejects.toThrow(
      'Too many redirects'
    )
  })

  it('never sends Authorization to a cross-origin redirect target', async () => {
    const fetchMock = globalThis.fetch as any
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/start')) {
        return { status: 302, headers: { get: () => 'https://evil.example/final' } }
      }
      return { status: 200, ok: true, json: async () => ({ done: true }) }
    })
    await expect(
      fetchWithSsrProtection('https://public.example/start', {
        method: 'POST',
        headers: { Authorization: 'Bearer SECRET-KEY', 'Content-Type': 'application/json' },
        body: '{"model":"gpt-4"}'
      })
    ).rejects.toThrow('Cross-origin redirect blocked')
    expect(
      fetchMock.mock.calls.some((call: unknown[]) =>
        String(call[0]).startsWith('https://evil.example')
      )
    ).toBe(false)
  })

  it('converts POST to GET without a body on 303 redirects', async () => {
    const fetchMock = globalThis.fetch as any
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/start')) {
        return { status: 303, headers: { get: () => 'https://public.example/final' } }
      }
      return { status: 200, ok: true, json: async () => ({ done: true }) }
    })
    const response = await fetchWithSsrProtection('https://public.example/start', {
      method: 'POST',
      headers: { Authorization: 'Bearer SECRET-KEY', 'Content-Type': 'application/json' },
      body: '{"model":"gpt-4"}'
    })
    expect(response.status).toBe(200)
    const lastCall = fetchMock.mock.lastCall
    expect(lastCall[0]).toBe('https://public.example/final')
    expect(lastCall[1].method).toBe('GET')
    expect(lastCall[1].body).toBeUndefined()
    expect((lastCall[1].headers as Headers).get('Content-Type')).toBeNull()
  })

  it('preserves method and body on 307 redirects', async () => {
    const fetchMock = globalThis.fetch as any
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/start')) {
        return { status: 307, headers: { get: () => 'https://public.example/final' } }
      }
      return { status: 200, ok: true, json: async () => ({ done: true }) }
    })
    const response = await fetchWithSsrProtection('https://public.example/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"model":"gpt-4"}'
    })
    expect(response.status).toBe(200)
    const lastCall = fetchMock.mock.lastCall
    expect(lastCall[0]).toBe('https://public.example/final')
    expect(lastCall[1].method).toBe('POST')
    expect(lastCall[1].body).toBe('{"model":"gpt-4"}')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import {
  fetchWithSsrProtection,
  validateProviderUrl
} from '../../../../features/ai/apiChatHandlers/ssrf.js'

type ServerHandle = {
  server: http.Server
  port: number
  requests: Array<{ url: string; method: string; headers: http.IncomingHttpHeaders; body: string }>
}

function startTestServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<ServerHandle> {
  const requests: ServerHandle['requests'] = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      requests.push({
        url: req.url || '/',
        method: req.method || 'GET',
        headers: req.headers,
        body
      })
      handler(req, res)
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ server, port, requests })
    })
  })
}

async function stopTestServer(handle: ServerHandle): Promise<void> {
  await new Promise<void>((resolve) => {
    handle.server.close(() => resolve())
  })
}

let handles: ServerHandle[] = []

beforeEach(() => {
  handles = []
})

afterEach(async () => {
  await Promise.all(handles.map((h) => stopTestServer(h).catch(() => {})))
  vi.restoreAllMocks()
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

describe('fetchWithSsrProtection (redirect revalidation + DNS pinning)', () => {
  it('blocks redirects to private addresses', async () => {
    const a = await startTestServer((_req, res) => {
      res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' })
      res.end()
    })
    handles.push(a)
    await expect(fetchWithSsrProtection(`http://127.0.0.1:${a.port}/start`)).rejects.toThrow(
      'SSRF blocked on redirect'
    )
  })

  it('blocks redirects that resolve to private addresses via DNS', async () => {
    const a = await startTestServer((_req, res) => {
      res.writeHead(302, { location: 'http://localhost:9999/final' })
      res.end()
    })
    handles.push(a)
    // "localhost" is allowed as a *target* for local dev, but a redirect to it
    // from a non-localhost origin must still fail the origin restriction.
    await expect(fetchWithSsrProtection(`http://127.0.0.1:${a.port}/start`)).rejects.toThrow(
      'Cross-origin redirect blocked'
    )
  })

  it('blocks cross-origin redirects even to public HTTPS hosts', async () => {
    const a = await startTestServer((_req, res) => {
      res.writeHead(302, { location: 'https://evil.example/final' })
      res.end()
    })
    handles.push(a)
    await expect(fetchWithSsrProtection(`http://127.0.0.1:${a.port}/start`)).rejects.toThrow(
      'Cross-origin redirect blocked'
    )
  })

  it('follows same-origin redirects', async () => {
    const a = await startTestServer((req, res) => {
      if (req.url === '/start') {
        res.writeHead(302, { location: '/final' })
        res.end()
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ done: true }))
    })
    handles.push(a)
    const response = await fetchWithSsrProtection(`http://127.0.0.1:${a.port}/start`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ done: true })
    expect(a.requests.map((r) => r.url)).toEqual(['/start', '/final'])
  })

  it('follows relative redirects on the same origin', async () => {
    const a = await startTestServer((req, res) => {
      if (req.url === '/v1/chat') {
        res.writeHead(302, { location: '../v2/chat' })
        res.end()
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    })
    handles.push(a)
    const response = await fetchWithSsrProtection(`http://127.0.0.1:${a.port}/v1/chat`)
    expect(response.status).toBe(200)
    expect(a.requests.map((r) => r.url)).toEqual(['/v1/chat', '/v2/chat'])
  })

  it('throws on redirect loops', async () => {
    const a = await startTestServer((_req, res) => {
      // Same-origin loop (relative location) so hop detection, not the
      // cross-origin guard, is what terminates the chain.
      res.writeHead(308, { location: '/again' })
      res.end()
    })
    handles.push(a)
    await expect(fetchWithSsrProtection(`http://127.0.0.1:${a.port}/start`)).rejects.toThrow(
      'Too many redirects'
    )
  })

  it('never sends Authorization to a cross-origin redirect target', async () => {
    const a = await startTestServer((req, res) => {
      if (req.url === '/start') {
        res.writeHead(302, { location: 'https://evil.example/final' })
        res.end()
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
    handles.push(a)
    await expect(
      fetchWithSsrProtection(`http://127.0.0.1:${a.port}/start`, {
        method: 'POST',
        headers: { Authorization: 'Bearer SECRET-KEY', 'Content-Type': 'application/json' },
        body: '{"model":"gpt-4"}'
      })
    ).rejects.toThrow('Cross-origin redirect blocked')
    // The redirect target was rejected before any request was dispatched to it.
    expect(a.requests.length).toBe(1)
    expect(a.requests[0].url).toBe('/start')
  })

  it('converts POST to GET without a body on 303 redirects', async () => {
    const a = await startTestServer((req, res) => {
      if (req.url === '/start') {
        res.writeHead(303, { location: '/final' })
        res.end()
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
    handles.push(a)
    const response = await fetchWithSsrProtection(`http://127.0.0.1:${a.port}/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer SECRET-KEY', 'Content-Type': 'application/json' },
      body: '{"model":"gpt-4"}'
    })
    expect(response.status).toBe(200)
    const finalRequest = a.requests.find((r) => r.url === '/final')
    expect(finalRequest).toBeDefined()
    expect(finalRequest?.method).toBe('GET')
    expect(finalRequest?.body).toBe('')
    expect(finalRequest?.headers.authorization).toBeUndefined()
  })

  it('preserves method and body on 307 redirects', async () => {
    const a = await startTestServer((req, res) => {
      if (req.url === '/start') {
        res.writeHead(307, { location: '/final' })
        res.end()
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
    handles.push(a)
    const response = await fetchWithSsrProtection(`http://127.0.0.1:${a.port}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"model":"gpt-4"}'
    })
    expect(response.status).toBe(200)
    const finalRequest = a.requests.find((r) => r.url === '/final')
    expect(finalRequest?.method).toBe('POST')
    expect(finalRequest?.body).toBe('{"model":"gpt-4"}')
  })

  it('aborts the pinned request when the signal fires', async () => {
    const a = await startTestServer((_req, res) => {
      // Never respond — the abort must tear the connection down.
      setTimeout(() => {
        if (!res.writableEnded) {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end('{}')
        }
      }, 2000)
    })
    handles.push(a)
    const controller = new AbortController()
    const promise = fetchWithSsrProtection(`http://127.0.0.1:${a.port}/chat`, {
      signal: controller.signal
    })
    setTimeout(() => controller.abort(), 50)
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})

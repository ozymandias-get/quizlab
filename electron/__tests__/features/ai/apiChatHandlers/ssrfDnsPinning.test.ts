import { classifyHost, HOST_SCOPE } from '../../../../features/ai/apiChatHandlers/ssrfIpUtils.js'
import {
  fetchWithSsrProtection,
  validateProviderUrl
} from '../../../../features/ai/apiChatHandlers/ssrf.js'

import type { LookupAddress } from 'node:dns'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ dnsLookup: vi.fn() }))

vi.mock('node:dns/promises', () => ({
  lookup: mocks.dnsLookup,
  default: { lookup: mocks.dnsLookup }
}))

const allow = { allowLocalNetwork: true }

function resolveTo(...addresses: string[]): void {
  mocks.dnsLookup.mockResolvedValue(
    addresses.map((address) => ({
      address,
      family: address.includes(':') ? 6 : 4
    })) satisfies LookupAddress[]
  )
}

type ServerHandle = { server: http.Server; port: number; hits: string[] }

async function startEchoServer(): Promise<ServerHandle> {
  const hits: string[] = []
  const server = http.createServer((req, res) => {
    hits.push(req.url || '/')
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: (server.address() as AddressInfo).port, hits })
    })
  })
}

let handles: ServerHandle[] = []

beforeEach(() => {
  handles = []
  mocks.dnsLookup.mockReset()
})

afterEach(async () => {
  await Promise.all(
    handles.map((h) => new Promise<void>((resolve) => h.server.close(() => resolve()).unref?.()))
  )
  vi.restoreAllMocks()
})

describe('classifyHost', () => {
  it('treats loopback and RFC 1918 / ULA as local model targets', () => {
    for (const host of [
      'localhost',
      '127.0.0.1',
      '127.255.255.254',
      '10.0.0.5',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.20',
      '::1',
      'fc00::1',
      'fd12:3456::1',
      '::ffff:127.0.0.1',
      '::ffff:192.168.1.20',
      // Single-label names only resolve on local namespaces.
      'ollama',
      'internal'
    ]) {
      expect(classifyHost(host), host).toBe(HOST_SCOPE.LOCAL_MODEL)
    }
  })

  it('classifies link local as special-use, including the metadata endpoint', () => {
    for (const host of [
      '169.254.169.254',
      '169.254.0.1',
      '169.254.255.255',
      'fe80::1',
      'febf::1',
      '::ffff:169.254.169.254',
      '::169.254.169.254',
      // 6to4 embeds an arbitrary IPv4 destination in the next 32 bits.
      '2002:a9fe:a9fe::'
    ]) {
      expect(classifyHost(host), host).toBe(HOST_SCOPE.SPECIAL_USE)
    }
  })

  it('classifies the remaining special-purpose blocks as special-use', () => {
    for (const host of [
      '0.0.0.0',
      '0.255.255.255',
      '100.64.0.1',
      '100.127.255.255',
      '198.18.0.1',
      '198.19.255.255',
      '192.0.2.1',
      '198.51.100.1',
      '203.0.113.1',
      '224.0.0.1',
      '239.255.255.255',
      '240.0.0.1',
      '255.255.255.255',
      '::',
      '::0.0.0.0',
      'ff00::1',
      'ff02::1',
      '2001:db8::1',
      '2001::1',
      '2002::1'
    ]) {
      expect(classifyHost(host), host).toBe(HOST_SCOPE.SPECIAL_USE)
    }
  })

  it('classifies globally routable addresses as public', () => {
    for (const host of [
      'api.openai.com',
      'example.com.',
      '8.8.8.8',
      '1.1.1.1',
      '172.32.0.1',
      '172.15.255.255',
      '100.128.0.1',
      '198.20.0.1',
      '2001:4860:4860::8888',
      '::ffff:8.8.8.8'
    ]) {
      expect(classifyHost(host), host).toBe(HOST_SCOPE.PUBLIC)
    }
  })

  it('classifies the DNS root and empty input as special-use', () => {
    expect(classifyHost('.')).toBe(HOST_SCOPE.SPECIAL_USE)
    expect(classifyHost('')).toBe(HOST_SCOPE.SPECIAL_USE)
  })

  it('is case- and bracket-insensitive', () => {
    expect(classifyHost('LOCALHOST')).toBe(HOST_SCOPE.LOCAL_MODEL)
    expect(classifyHost('[::1]')).toBe(HOST_SCOPE.LOCAL_MODEL)
    expect(classifyHost('[169.254.169.254]')).toBe(HOST_SCOPE.SPECIAL_USE)
    expect(classifyHost('169.254.169.254.')).toBe(HOST_SCOPE.SPECIAL_USE)
  })
})

describe('validateProviderUrl special-use policy', () => {
  it('blocks the metadata endpoint with and without the opt-in', () => {
    expect(validateProviderUrl('https://169.254.169.254')).toContain('SSRF blocked')
    expect(validateProviderUrl('https://169.254.169.254', allow)).toContain('SSRF blocked')
    expect(validateProviderUrl('https://169.254.169.254', { allowLocalNetwork: false })).toContain(
      'SSRF blocked'
    )
  })

  it('allows a local model server host with the opt-in', () => {
    expect(validateProviderUrl('http://127.0.0.1:11434/v1', allow)).toBeNull()
    expect(validateProviderUrl('http://10.0.0.5:11434/v1', allow)).toBeNull()
    expect(validateProviderUrl('http://192.168.1.20:1234/v1', allow)).toBeNull()
    expect(validateProviderUrl('http://ollama:11434/v1', allow)).toBeNull()
  })
})

describe('DNS pinning applies the same policy as the literal URL', () => {
  it('rejects a hostname that resolves to the metadata endpoint even with the opt-in', async () => {
    resolveTo('169.254.169.254')
    await expect(
      fetchWithSsrProtection('https://rebind.example.com/v1/models', undefined, allow)
    ).rejects.toThrow(/resolved to special-use address 169\.254\.169\.254/)
  })

  it('rejects the same hostname without the opt-in', async () => {
    resolveTo('169.254.169.254')
    await expect(fetchWithSsrProtection('https://rebind.example.com/v1/models')).rejects.toThrow(
      /resolved to special-use address 169\.254\.169\.254/
    )
  })

  it('rejects the whole request when only one record is special-use', async () => {
    resolveTo('93.184.216.34', '169.254.169.254')
    await expect(
      fetchWithSsrProtection('https://mixed.example.com/v1/models', undefined, allow)
    ).rejects.toThrow(/resolved to special-use address/)
  })

  it('rejects other special-use ranges that DNS can return', async () => {
    for (const address of ['100.64.0.1', '198.18.0.1', '203.0.113.5', 'fe80::1']) {
      resolveTo(address)
      await expect(
        fetchWithSsrProtection('https://special.example.com/v1/models', undefined, allow),
        address
      ).rejects.toThrow(/special-use/)
    }
  })

  it('still rejects a LAN address without the opt-in', async () => {
    resolveTo('192.168.1.20')
    await expect(fetchWithSsrProtection('https://lan.example.com/v1/models')).rejects.toThrow(
      /resolved to private address 192\.168\.1\.20/
    )
  })

  it('reaches a local model server resolved through DNS with the opt-in', async () => {
    const handle = await startEchoServer()
    handles.push(handle)
    resolveTo('127.0.0.1')

    // A single-label hostname classifies as local, so plain HTTP is allowed and
    // the pinned socket lands on the test server standing in for Ollama.
    //
    // Regression guard: the host here is a NAME, not an IP literal, so net.connect
    // really does call the injected `lookup`. That callback used to hand back a
    // bare address while Node's default autoSelectFamily had asked for
    // `{ all: true }`, so every hostname-based provider — api.openai.com and
    // friends — failed with "Invalid IP address: undefined". IP-literal tests
    // never exercised it because net.connect skips DNS for a literal host.
    const response = await fetchWithSsrProtection(
      `http://ollama:${handle.port}/v1/models`,
      undefined,
      allow
    )

    expect(response.status).toBe(200)
    expect(handle.hits).toEqual(['/v1/models'])
    expect(mocks.dnsLookup).toHaveBeenCalledWith('ollama', { all: true, verbatim: true })
  })
})

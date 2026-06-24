import { describe, expect, it } from 'vitest'

import { validateProviderUrl } from '../../../../features/ai/apiChatHandlers/ssrf.js'

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

  it('rejects IPv6 loopback', () => {
    expect(validateProviderUrl('https://[::1]')).toContain('SSRF blocked')
  })

  it('rejects malformed URLs', () => {
    expect(validateProviderUrl('not a url')).toBe('Invalid URL')
    expect(validateProviderUrl('http://')).toBe('Invalid URL')
  })
})

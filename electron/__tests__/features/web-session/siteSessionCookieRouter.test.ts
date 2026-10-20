import { describe, expect, it } from 'vitest'

import {
  isDomainAllowedForTarget,
  routeCookiePacket
} from '../../../features/web-session/siteSessionCookieRouter.js'

const CHATGPT = {
  siteId: 'chatgpt',
  hostname: 'chatgpt.com',
  origins: ['https://chatgpt.com'],
  partition: 'persist:ai_chatgpt',
  cookieDomains: ['.chatgpt.com', '.openai.com'],
  labelKey: 'ws_target_chatgpt',
  kind: 'builtin' as const,
  memberAppIds: ['chatgpt']
}

const CLAUDE = {
  ...CHATGPT,
  siteId: 'claude',
  hostname: 'claude.ai',
  partition: 'persist:ai_claude',
  cookieDomains: ['.claude.ai', '.anthropic.com'],
  memberAppIds: ['claude']
}

function packetFor(targetId: string, domain: string) {
  return {
    targetId,
    status: 'ok' as const,
    cookies: [{ name: 'session', value: 'x', domain }]
  }
}

describe('cookie domain matching', () => {
  it('accepts a domain listed for the target', () => {
    expect(isDomainAllowedForTarget('.chatgpt.com', CHATGPT.cookieDomains)).toBe(true)
  })

  it('accepts a host-only cookie of a listed domain', () => {
    expect(isDomainAllowedForTarget('chatgpt.com', CHATGPT.cookieDomains)).toBe(true)
  })

  it('accepts a subdomain of a listed domain', () => {
    expect(isDomainAllowedForTarget('mail.chatgpt.com', CHATGPT.cookieDomains)).toBe(true)
  })

  it('rejects a domain of another site', () => {
    expect(isDomainAllowedForTarget('.claude.ai', CHATGPT.cookieDomains)).toBe(false)
  })

  it('rejects a lookalike domain that merely ends with the target host', () => {
    expect(isDomainAllowedForTarget('.notchatgpt.com', CHATGPT.cookieDomains)).toBe(false)
  })

  it('rejects a domain that only starts with the target host', () => {
    expect(isDomainAllowedForTarget('.chatgpt.com.evil.com', CHATGPT.cookieDomains)).toBe(false)
  })
})

describe('cookie packet routing', () => {
  it('routes a packet to its own target', () => {
    const result = routeCookiePacket(
      packetFor('chatgpt', '.chatgpt.com'),
      [CHATGPT, CLAUDE],
      () => true
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.target.partition).toBe('persist:ai_chatgpt')
  })

  it('rejects a packet for an unknown target', () => {
    const result = routeCookiePacket(packetFor('nope', '.chatgpt.com'), [CHATGPT], () => true)
    expect(result).toEqual({ ok: false, reason: 'unknown_target' })
  })

  it('rejects a packet for a disabled target', () => {
    const result = routeCookiePacket(packetFor('chatgpt', '.chatgpt.com'), [CHATGPT], () => false)
    expect(result).toEqual({ ok: false, reason: 'target_disabled' })
  })

  it('rejects a packet that carries another site domain', () => {
    const result = routeCookiePacket(packetFor('chatgpt', '.claude.ai'), [CHATGPT], () => true)
    expect(result).toEqual({ ok: false, reason: 'domain_mismatch' })
  })

  it('rejects a packet that carries one foreign cookie among its own', () => {
    const result = routeCookiePacket(
      {
        targetId: 'chatgpt',
        status: 'ok',
        cookies: [
          { name: 'session', value: 'x', domain: '.chatgpt.com' },
          { name: 'session', value: 'y', domain: '.claude.ai' }
        ]
      },
      [CHATGPT],
      () => true
    )
    expect(result).toEqual({ ok: false, reason: 'domain_mismatch' })
  })

  it('accepts an empty packet for an enabled target', () => {
    const result = routeCookiePacket(
      { targetId: 'chatgpt', status: 'no_cookies', cookies: [] },
      [CHATGPT],
      () => true
    )
    expect(result.ok).toBe(true)
  })
})

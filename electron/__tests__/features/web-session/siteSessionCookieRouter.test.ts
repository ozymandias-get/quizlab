import { describe, expect, it } from 'vitest'

import type { ChromeExtensionCookie } from '@shared-core/types'

import { isCookieDomainAllowed } from '../../../features/web-session/siteSessionCookies.js'
import {
  type CookiePacket,
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

const GOOGLE = {
  siteId: 'google',
  hostname: 'google.com',
  origins: ['https://google.com'],
  partition: 'persist:ai_google',
  cookieDomains: ['.google.com'],
  labelKey: 'ws_target_google',
  kind: 'google' as const,
  memberAppIds: ['google']
}

const foreignCookie = { name: 'session', value: 'y', domain: '.claude.ai' }

function packet(targetId: string, ...cookies: ChromeExtensionCookie[]): CookiePacket {
  return {
    targetId,
    status: 'ok',
    cookies: cookies.length > 0 ? cookies : [{ name: 'session', value: 'x', domain: '.google.com' }]
  }
}

describe('cookie domain matching', () => {
  it('accepts a domain listed for the target', () => {
    expect(isCookieDomainAllowed('.chatgpt.com', CHATGPT.cookieDomains)).toBe(true)
  })

  it('accepts a host-only cookie of a listed domain', () => {
    expect(isCookieDomainAllowed('chatgpt.com', CHATGPT.cookieDomains)).toBe(true)
  })

  it('accepts a subdomain of a listed domain', () => {
    expect(isCookieDomainAllowed('mail.chatgpt.com', CHATGPT.cookieDomains)).toBe(true)
  })

  it('rejects a domain of another site', () => {
    expect(isCookieDomainAllowed('.claude.ai', CHATGPT.cookieDomains)).toBe(false)
  })

  it('rejects a lookalike domain that merely ends with the target host', () => {
    expect(isCookieDomainAllowed('.notchatgpt.com', CHATGPT.cookieDomains)).toBe(false)
  })

  it('rejects a domain that only starts with the target host', () => {
    expect(isCookieDomainAllowed('.chatgpt.com.evil.com', CHATGPT.cookieDomains)).toBe(false)
  })
})

describe('cookie packet routing', () => {
  it('routes a packet to its own target and account', () => {
    const route = routeCookiePacket(
      packet('chatgpt', { name: 'session', value: 'x', domain: '.chatgpt.com' }),
      CHATGPT,
      [{ accountId: 'primary', fingerprints: [] }],
      null
    )
    expect(route.ok).toBe(true)
    if (route.ok) {
      expect(route.kind).toBe('account')
      expect(route.target.partition).toBe('persist:ai_chatgpt')
    }
  })

  it('refuses a packet whose site is unknown', () => {
    const route = routeCookiePacket(packet('chatgpt'), null, [], null)
    expect(route).toEqual({ ok: false, kind: 'refused', reason: 'unknown_target' })
  })

  it('refuses a packet whose site has no open account', () => {
    const route = routeCookiePacket(packet('google'), GOOGLE, [], null)
    expect(route).toEqual({ ok: false, kind: 'refused', reason: 'target_disabled' })
  })

  it('refuses a packet that carries a cookie of another site', () => {
    const route = routeCookiePacket(
      packet('google', foreignCookie),
      GOOGLE,
      [{ accountId: 'primary', fingerprints: [] }],
      null
    )
    expect(route).toEqual({ ok: false, kind: 'refused', reason: 'domain_mismatch' })
  })

  it('rejects a packet that carries one foreign cookie among its own', () => {
    const route = routeCookiePacket(
      packet('google', { name: 'session', value: 'x', domain: '.google.com' }, foreignCookie),
      GOOGLE,
      [{ accountId: 'primary', fingerprints: [] }],
      null
    )
    expect(route).toEqual({ ok: false, kind: 'refused', reason: 'domain_mismatch' })
  })

  it('routes the packet to the account whose history holds the fingerprint', () => {
    const route = routeCookiePacket(
      packet('google'),
      GOOGLE,
      [{ accountId: 'a1', fingerprints: ['fp'] }],
      'fp'
    )
    expect(route.ok && route.kind === 'account' ? route.accountId : null).toBe('a1')
  })

  it('asks for a new account when no open account can take the session', () => {
    const route = routeCookiePacket(
      packet('google'),
      GOOGLE,
      [{ accountId: 'a1', fingerprints: ['other'] }],
      'fp'
    )
    expect(route.ok && route.kind).toBe('new_account')
  })

  it('holds the packet when the session has no fingerprint and several accounts are open', () => {
    const route = routeCookiePacket(
      packet('google'),
      GOOGLE,
      [
        { accountId: 'a1', fingerprints: [] },
        { accountId: 'a2', fingerprints: [] }
      ],
      null
    )
    expect(route.ok).toBe(false)
    expect(route.ok === false && route.kind).toBe('ambiguous')
  })

  it('keeps the target and the cookies of a packet it holds', () => {
    const held = packet('google')
    const route = routeCookiePacket(
      held,
      GOOGLE,
      [
        { accountId: 'a1', fingerprints: [] },
        { accountId: 'a2', fingerprints: [] }
      ],
      null
    )
    expect(route).toEqual({
      ok: false,
      kind: 'ambiguous',
      target: GOOGLE,
      cookies: held.cookies
    })
  })

  it('accepts an empty packet for a site with an open account', () => {
    const route = routeCookiePacket(
      { targetId: 'chatgpt', status: 'no_cookies', cookies: [] },
      CHATGPT,
      [{ accountId: 'primary', fingerprints: [] }],
      null
    )
    expect(route.ok).toBe(true)
  })
})

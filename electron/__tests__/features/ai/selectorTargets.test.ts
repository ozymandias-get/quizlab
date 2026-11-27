/**
 * The catalogue a Chrome pick is validated against.
 *
 * It is built from the platform registry, not from the site-session targets, so
 * a pick works while the session sync is off. The host rule is resolved once
 * here and shipped to the extension, which is why it is pinned: a host that
 * would let a pick on an unrelated page through must not appear.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../features/ai/customPlatformStore.js', () => ({
  readCustomPlatforms: async () => ({
    'my-site': {
      id: 'my-site',
      name: 'My Site',
      url: 'https://chat.example.org/',
      partition: 'persist:custom_my_site',
      isSite: true
    }
  })
}))

import {
  buildSelectorSiteTargets,
  findSelectorSiteMatch,
  hostBelongsToSelectorSite,
  hostStatusesOfSite,
  matchSelectorSite,
  statusOfSite,
  type SelectorSiteTarget
} from '../../../features/ai/selectorTargets.js'

function target(overrides: Partial<SelectorSiteTarget> & { siteId: string }): SelectorSiteTarget {
  return {
    displayName: overrides.siteId,
    hostname: 'example.com',
    hosts: ['example.com'],
    fields: ['input', 'button'],
    canonicalHostname: 'example.com',
    ...overrides
  }
}

describe('selector site catalogue', () => {
  it('offers the built-in platforms and the user-added site', async () => {
    const sites = await buildSelectorSiteTargets()
    const ids = sites.map((site) => site.siteId)
    expect(ids).toContain('chatgpt')
    expect(ids).toContain('claude')
    expect(ids).toContain('custom:my-site')
    // Every entry is targetable for both fields the schema supports.
    for (const site of sites) {
      expect(site.fields).toEqual(['input', 'button'])
      expect(site.hosts.length).toBeGreaterThan(0)
    }
  })

  it('accepts the canonical host when it belongs to exactly one site', async () => {
    const sites = await buildSelectorSiteTargets()
    const deepseek = sites.find((site) => site.siteId === 'deepseek')
    expect(deepseek?.hosts).toContain('deepseek.com')
    expect(matchSelectorSite('deepseek.com', sites)?.siteId).toBe('deepseek')
  })

  it('does not let the Google apps share a host through their canonical name', async () => {
    const sites = await buildSelectorSiteTargets()
    const gemini = sites.find((site) => site.siteId === 'gemini')
    expect(gemini?.hosts).not.toContain('google.com')
    expect(hostBelongsToSelectorSite('mail.google.com', gemini as never)).toBe(false)
    expect(matchSelectorSite('mail.google.com', sites)).toBeNull()
  })

  it('refuses a host the app never named', async () => {
    const sites = await buildSelectorSiteTargets()
    expect(matchSelectorSite('evil.example', sites)).toBeNull()
    // A suffix that only looks like a known host is not a match.
    expect(matchSelectorSite('evil-chatgpt.com', sites)).toBeNull()
  })

  it('matches the user-added site and its subdomains', async () => {
    const sites = await buildSelectorSiteTargets()
    expect(matchSelectorSite('chat.example.org', sites)?.siteId).toBe('custom:my-site')
    expect(matchSelectorSite('app.chat.example.org', sites)?.siteId).toBe('custom:my-site')
  })

  it('prefers an exact host over a parent site that would also match', () => {
    const parent = target({ siteId: 'parent', hostname: 'example.com', hosts: ['example.com'] })
    const child = target({
      siteId: 'child',
      hostname: 'foo.example.com',
      hosts: ['foo.example.com']
    })
    expect(matchSelectorSite('foo.example.com', [parent, child])?.siteId).toBe('child')
  })

  it('reports two sites on one host as ambiguous instead of picking the first', () => {
    const first = target({ siteId: 'first' })
    const second = target({ siteId: 'second' })
    expect(matchSelectorSite('example.com', [first, second])).toBeNull()
    expect(findSelectorSiteMatch('example.com', [first, second])?.ambiguous).toBe(true)
  })

  it('refuses two sites sharing a hostname even when their entry paths differ', () => {
    const first = target({
      siteId: 'assistant-a',
      hostname: 'example.com',
      pathPrefix: '/assistant-a'
    })
    const second = target({
      siteId: 'assistant-b',
      hostname: 'example.com',
      pathPrefix: '/assistant-b'
    })
    const sites = [first, second]
    expect(findSelectorSiteMatch('example.com', sites, '/assistant-a')?.ambiguous).toBe(true)
    expect(matchSelectorSite('example.com', sites, '/assistant-a')).toBeNull()
    expect(matchSelectorSite('example.com', sites, '/assistant-b')).toBeNull()
    // A path below a site that only exists elsewhere is not that site.
    expect(matchSelectorSite('example.com', [first], '/other')).toBeNull()
  })

  it('refuses built-in and custom sites colliding on the same hostname', () => {
    const builtin = target({ siteId: 'chatgpt', hostname: 'chatgpt.com', hosts: ['chatgpt.com'] })
    const custom = target({
      siteId: 'custom:my-gpt',
      hostname: 'chatgpt.com',
      hosts: ['chatgpt.com'],
      pathPrefix: '/g/custom'
    })
    expect(findSelectorSiteMatch('chatgpt.com', [builtin, custom], '/g/custom')?.ambiguous).toBe(
      true
    )
  })

  it('keeps distinct subdomains with a shared canonical hostname independent', () => {
    const a = target({
      siteId: 'a',
      hostname: 'a.example.com',
      hosts: ['a.example.com'],
      canonicalHostname: 'example.com'
    })
    const b = target({
      siteId: 'b',
      hostname: 'b.example.com',
      hosts: ['b.example.com'],
      canonicalHostname: 'example.com'
    })
    expect(matchSelectorSite('a.example.com', [a, b])?.siteId).toBe('a')
    expect(matchSelectorSite('b.example.com', [a, b])?.siteId).toBe('b')
  })

  it('resolves statusOfSite using exact-host priority and per-field repair state', () => {
    const chatgpt = target({
      siteId: 'chatgpt',
      hostname: 'chatgpt.com',
      hosts: ['chatgpt.com', 'openai.com'],
      canonicalHostname: 'openai.com'
    })
    const status = statusOfSite(chatgpt, {
      'openai.com': { input: '#old', button: '#old-btn', health: 'ready' },
      'chatgpt.com': {
        input: '#prompt',
        button: '#send',
        health: 'needs_repick',
        repair: {
          button: { selector: '#new-send' }
        }
      }
    })
    expect(status).toEqual({ input: 'ready', button: 'needs_repick' })

    const unattributed = statusOfSite(chatgpt, {
      'chatgpt.com': {
        input: '#prompt',
        button: '#send',
        health: 'needs_repick'
      }
    })
    expect(unattributed).toEqual({ input: 'unknown', button: 'unknown' })
  })

  it('never targets a login or account page', () => {
    const site = target({ siteId: 'site' })
    expect(matchSelectorSite('example.com', [site], '/login')).toBeNull()
    expect(matchSelectorSite('example.com', [site], '/account/security')).toBeNull()
    expect(matchSelectorSite('example.com', [site], '/chat')).not.toBeNull()
  })

  it('does not turn a built-in landing path into a pick restriction', async () => {
    const sites = await buildSelectorSiteTargets()
    const gemini = sites.find((site) => site.siteId === 'gemini')
    // The entry URL is /app, but Gemini opens nested conversation routes and a
    // re-login can land on the host root. All of them are still Gemini.
    expect(gemini?.pathPrefix).toBeUndefined()
    expect(matchSelectorSite('gemini.google.com', sites, '/app/abc')?.siteId).toBe('gemini')
    expect(matchSelectorSite('gemini.google.com', sites, '/')?.siteId).toBe('gemini')
  })

  it('does not fall back to a sibling subdomain config that automation will not load', () => {
    const rootSite = target({
      siteId: 'root',
      hostname: 'example.com',
      hosts: ['example.com'],
      canonicalHostname: 'example.com'
    })
    expect(
      statusOfSite(rootSite, {
        'sub.example.com': { input: '#in', button: '#btn', health: 'ready' }
      })
    ).toBeUndefined()
  })

  it('computes per-host statuses when active or live view host differs from registry hostname', () => {
    const site = target({
      siteId: 'example',
      hostname: 'example.com',
      hosts: ['example.com'],
      canonicalHostname: 'example.com'
    })
    const hostStatuses = hostStatusesOfSite(
      site,
      {
        'chat.example.com': { input: '#in', button: '#btn', health: 'ready' }
      },
      ['chat.example.com', 'app.example.com']
    )
    expect(hostStatuses).toEqual({
      'chat.example.com': { input: 'ready', button: 'ready' }
    })
  })
})

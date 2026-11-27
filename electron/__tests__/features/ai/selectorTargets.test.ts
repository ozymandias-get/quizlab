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
  matchSelectorSite,
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

  it('uses the entry path when two sites share a host', () => {
    const root = target({ siteId: 'root' })
    const chat = target({ siteId: 'chat', hostname: 'example.com', pathPrefix: '/chat' })
    const sites = [root, chat]
    expect(matchSelectorSite('example.com', sites, '/chat/42')?.siteId).toBe('chat')
    expect(matchSelectorSite('example.com', sites, '/other')?.siteId).toBe('root')
    // A path below a site that only exists elsewhere is not that site.
    expect(matchSelectorSite('example.com', [chat], '/other')).toBeNull()
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
})

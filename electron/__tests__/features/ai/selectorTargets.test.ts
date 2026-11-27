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
  hostBelongsToSelectorSite,
  matchSelectorSite
} from '../../../features/ai/selectorTargets.js'

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
})

import { readFileSync } from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

import {
  SITE_SESSION_COOKIE_DOMAINS,
  getSiteSessionCookieDomains
} from '../../../../shared/constants/siteSessionCookieDomains.js'

const MANIFEST_PATH = path.join(process.cwd(), 'extensions/quizlab-session-extension/manifest.json')

interface SessionExtensionManifest {
  host_permissions?: string[]
  optional_host_permissions?: string[]
}

function readManifest(): SessionExtensionManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as SessionExtensionManifest
}

function manifestHostPermissions(): string[] {
  return readManifest().host_permissions ?? []
}

function manifestOptionalHostPermissions(): string[] {
  return readManifest().optional_host_permissions ?? []
}

/** A Chrome match pattern host covers the bare host and every subdomain of it. */
function hostIsCovered(host: string, patternHost: string): boolean {
  const bare = patternHost.replace(/^\*\./, '')
  return host === bare || host.endsWith(`.${bare}`)
}

describe('site session cookie domains', () => {
  it('covers every built-in site with its identity domains', () => {
    expect(getSiteSessionCookieDomains('chatgpt')).toEqual(['.chatgpt.com', '.openai.com'])
    expect(getSiteSessionCookieDomains('claude')).toEqual(['.claude.ai', '.anthropic.com'])
    expect(getSiteSessionCookieDomains('google')).toEqual([
      '.google.com',
      '.gemini.google.com',
      '.aistudio.google.com',
      '.youtube.com'
    ])
    expect(getSiteSessionCookieDomains('m365')).toEqual([
      '.microsoft.com',
      '.microsoftonline.com',
      '.live.com'
    ])
  })

  it('returns an empty list for an unknown site', () => {
    expect(getSiteSessionCookieDomains('does-not-exist')).toEqual([])
  })

  it('returns an empty list for prototype-chain ids', () => {
    for (const siteId of ['constructor', 'toString', '__proto__', 'valueOf', 'hasOwnProperty']) {
      expect(getSiteSessionCookieDomains(siteId), siteId).toEqual([])
    }
  })

  it('declares a host permission for every cookie domain', () => {
    const patterns = manifestHostPermissions()
    for (const [siteId, domains] of Object.entries(SITE_SESSION_COOKIE_DOMAINS)) {
      for (const domain of domains) {
        const host = domain.replace(/^\./, '')
        const covered = patterns.some((pattern) => {
          const url = new URL(pattern)
          return url.protocol === 'https:' && hostIsCovered(host, url.hostname)
        })
        expect(covered, `${siteId} -> ${domain} has no host permission`).toBe(true)
      }
    }
  })

  it('declares the wildcard optional host permissions for user-added sites', () => {
    const optional = manifestOptionalHostPermissions()
    expect(optional).toContain('http://*/*')
    expect(optional).toContain('https://*/*')
  })
})

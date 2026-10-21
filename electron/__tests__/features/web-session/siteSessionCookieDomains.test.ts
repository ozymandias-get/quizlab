import { readFileSync } from 'node:fs'
import path from 'node:path'

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

/**
 * The domains of every site, site by site.
 *
 * The table is pinned as a whole: a row that gains or loses a domain changes
 * what the extension may read and what the wipe may delete, so the change has
 * to be a deliberate one. A site that is added has to be added here as well.
 */
const EXPECTED_COOKIE_DOMAINS: Record<string, readonly string[]> = {
  chatgpt: ['.chatgpt.com', '.openai.com'],
  claude: ['.claude.ai', '.anthropic.com'],
  google: ['.google.com', '.gemini.google.com', '.aistudio.google.com', '.youtube.com'],
  deepseek: ['.deepseek.com'],
  qwen: ['.qwenlm.ai', '.qwen.ai'],
  kimi: ['.kimi.com', '.moonshot.cn'],
  m365: ['.microsoft.com', '.microsoftonline.com', '.live.com', '.cloud.microsoft'],
  copilot: ['.microsoft.com', '.microsoftonline.com', '.live.com'],
  grok: ['.grok.com', '.x.com'],
  mistral: ['.mistral.ai'],
  perplexity: ['.perplexity.ai'],
  huggingchat: ['.huggingface.co'],
  manus: ['.manus.im']
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
  it('pins the domains of every site', () => {
    expect(SITE_SESSION_COOKIE_DOMAINS).toEqual(EXPECTED_COOKIE_DOMAINS)
  })

  it('never lists the same domain twice in a row', () => {
    // A domain that is listed twice is read twice and removed twice: the
    // extension collects it twice and the table says nothing about it.
    for (const [siteId, domains] of Object.entries(SITE_SESSION_COOKIE_DOMAINS)) {
      expect(new Set(domains).size, `${siteId} lists a domain twice`).toBe(domains.length)
    }
  })

  it('returns the domains of a site', () => {
    expect(getSiteSessionCookieDomains('chatgpt')).toEqual(['.chatgpt.com', '.openai.com'])
    expect(getSiteSessionCookieDomains('m365')).toEqual([
      '.microsoft.com',
      '.microsoftonline.com',
      '.live.com',
      '.cloud.microsoft'
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

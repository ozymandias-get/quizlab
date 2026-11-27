/**
 * The sites a Chrome pick may target, and the fields each one accepts.
 *
 * This catalogue is built from the app's own platform registry, not from the
 * site-session target list: the magic selector must work while the session
 * sync is off and for a custom site whose session is not imported. A site is
 * included only when it has a usable https entry URL — a pick has to be
 * verifiable in the matching managed view.
 *
 * The `hosts` list is resolved here, once, so the extension and the bridge use
 * exactly the same rule:
 *
 *   - the platform's own host and every subdomain of it;
 *   - the canonical host (the registrable domain, `chat.openai.com` ->
 *     `openai.com`), but only when no other site shares that canonical name.
 *     The Google apps all canonicalise to `google.com`; adding it would let a
 *     pick on any Google page pass the site check, so it stays out.
 */
import { GOOGLE_WEB_SESSION_APPS } from '../../../shared/constants/googleAiWebApps.js'
import type {
  SelectorField,
  SelectorSiteEntry,
  SelectorSiteStatus
} from '../../../shared/constants/selectorTransfer.js'
import { canonicalizeHostname } from '../../../shared/selectorConfig.js'
import type { AiPlatform } from '../../../shared/types/ai.js'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from './aiManager.js'
import { readCustomPlatforms } from './customPlatformStore.js'

/** The locator fields the existing selector schema supports. */
const SELECTOR_TARGET_FIELDS: readonly SelectorField[] = ['input', 'button'] as const

/** A site entry plus the identity the ingestion needs. */
export interface SelectorSiteTarget extends SelectorSiteEntry {
  canonicalHostname: string
}

function usableEntry(platform: AiPlatform, siteId: string): SelectorSiteTarget | null {
  const rawUrl = typeof platform.url === 'string' ? platform.url.trim() : ''
  if (!rawUrl) return null
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  const hostname = parsed.hostname.toLowerCase()
  if (!hostname) return null
  const canonicalHostname = canonicalizeHostname(hostname) || hostname
  const displayName =
    (typeof platform.displayName === 'string' && platform.displayName.trim()) ||
    (typeof platform.name === 'string' && platform.name.trim()) ||
    siteId
  return {
    siteId,
    displayName: displayName.slice(0, 120),
    hostname,
    hosts: [hostname],
    fields: [...SELECTOR_TARGET_FIELDS],
    canonicalHostname
  }
}

/**
 * Adds the canonical host where it identifies exactly one site.
 *
 * A canonical name shared by several sites cannot be a site identity: the
 * Google apps are the case that matters.
 */
function resolveHosts(entries: SelectorSiteTarget[]): SelectorSiteTarget[] {
  const canonicalCounts = new Map<string, number>()
  for (const entry of entries) {
    canonicalCounts.set(
      entry.canonicalHostname,
      (canonicalCounts.get(entry.canonicalHostname) ?? 0) + 1
    )
  }
  return entries.map((entry) => {
    const hosts = [entry.hostname]
    if (
      canonicalCounts.get(entry.canonicalHostname) === 1 &&
      entry.canonicalHostname !== entry.hostname
    ) {
      hosts.push(entry.canonicalHostname)
    }
    return { ...entry, hosts }
  })
}

/**
 * Every site the app can pick on.
 *
 * Built-in platforms, the inactive ones (a user may still open them) and the
 * user-added sites are all included; duplicates are collapsed by host.
 */
export async function buildSelectorSiteTargets(): Promise<SelectorSiteTarget[]> {
  const entries: SelectorSiteTarget[] = []
  const seen = new Set<string>()

  const add = (platform: AiPlatform, siteId: string) => {
    const entry = usableEntry(platform, siteId)
    if (!entry || seen.has(entry.hostname)) return
    seen.add(entry.hostname)
    entries.push(entry)
  }

  for (const [siteId, platform] of Object.entries(AI_REGISTRY)) add(platform, siteId)
  for (const [siteId, platform] of Object.entries(INACTIVE_PLATFORMS)) add(platform, siteId)
  for (const app of GOOGLE_WEB_SESSION_APPS) {
    add({ id: app.id, name: app.name, url: app.url }, app.id)
  }

  const customPlatforms = await readCustomPlatforms()
  for (const [id, platform] of Object.entries(customPlatforms)) {
    add(platform, `custom:${id}`)
  }

  return resolveHosts(entries)
}

/** Whether a hostname belongs to a site, using the same rule as the extension. */
export function hostBelongsToSelectorSite(hostname: string, site: SelectorSiteTarget): boolean {
  const normalized = hostname.trim().toLowerCase()
  if (!normalized) return false
  return site.hosts.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`))
}

/** The site a hostname belongs to, or null when the app did not name it. */
export function matchSelectorSite(
  hostname: string,
  sites: readonly SelectorSiteTarget[]
): SelectorSiteTarget | null {
  return sites.find((site) => hostBelongsToSelectorSite(hostname, site)) ?? null
}

/** The status of a site's two locators, from the stored config map. */
export function statusOfSite(
  site: SelectorSiteTarget,
  configs: Readonly<Record<string, { health?: string; input?: unknown; button?: unknown }>>
): SelectorSiteStatus | undefined {
  const related = Object.entries(configs)
    .filter(([host]) => {
      const normalized = host.toLowerCase()
      return site.hosts.some(
        (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`)
      )
    })
    .map(([, config]) => config)
  if (related.length === 0) return undefined
  const pick = (field: 'input' | 'button'): SelectorSiteStatus['input'] => {
    const configured = related.find((config) => typeof config[field] === 'string' && config[field])
    if (!configured) return 'missing'
    const health = configured.health
    if (
      health === 'ready' ||
      health === 'migrated' ||
      health === 'repaired' ||
      health === 'needs_repick'
    ) {
      return health
    }
    return 'ready'
  }
  return { input: pick('input'), button: pick('button') }
}

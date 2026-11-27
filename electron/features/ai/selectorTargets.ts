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
import { type AiConfigMap, resolveConfigForHostname } from './aiConfigDomain.js'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from './aiManager.js'
import { readCustomPlatforms } from './customPlatformStore.js'

/** The locator fields the existing selector schema supports. */
const SELECTOR_TARGET_FIELDS: readonly SelectorField[] = ['input', 'button'] as const

/** A site entry plus the identity the ingestion needs. */
export interface SelectorSiteTarget extends SelectorSiteEntry {
  canonicalHostname: string
  /** The entry path when the site lives below the host root (`/chat`). */
  pathPrefix?: string
}

/** The answer of the site matcher. */
export interface SelectorSiteMatch {
  site: SelectorSiteTarget
  /** Several sites matched equally well; the caller must not pick one. */
  ambiguous: boolean
}

/** The path an entry URL names, normalized for prefix comparison. */
function entryPathPrefix(pathname: string): string | undefined {
  const trimmed = pathname.replace(/\/+$/, '')
  if (!trimmed || trimmed === '') return undefined
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function usableEntry(
  platform: AiPlatform,
  siteId: string,
  useEntryPath = false
): SelectorSiteTarget | null {
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
  // A built-in entry URL is the app's landing page, not a path boundary: Gemini
  // opens on `/app`, AI Studio moves to `/prompts/...` after login, and a pick
  // on those pages is legitimate. Only a user-added site's entry path is an
  // identity, because two custom sites can share one host.
  const pathPrefix = useEntryPath ? entryPathPrefix(parsed.pathname) : undefined
  return {
    siteId,
    displayName: displayName.slice(0, 120),
    hostname,
    hosts: [hostname],
    fields: [...SELECTOR_TARGET_FIELDS],
    canonicalHostname,
    ...(pathPrefix ? { pathPrefix } : {})
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
  const seenSiteIds = new Set<string>()

  const add = (platform: AiPlatform, siteId: string) => {
    if (seenSiteIds.has(siteId)) return
    const entry = usableEntry(platform, siteId, siteId.startsWith('custom:'))
    if (!entry) return
    seenSiteIds.add(siteId)
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

/**
 * Pages that are never a selector target: a login or account page is not the
 * composer the automation uses, even when it belongs to the same host.
 */
const EXCLUDED_SELECTOR_PATHS =
  /^\/(?:auth|login|signin|sign-in|signup|sign-up|register|account|accounts|oauth|sso|session)(?:\/|$)/i

/** Whether a page path belongs to a site entry. */
export function pathBelongsToSelectorSite(
  pathname: string | undefined,
  site: SelectorSiteTarget
): boolean {
  if (!pathname) return !site.pathPrefix
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (EXCLUDED_SELECTOR_PATHS.test(path)) return false
  if (!site.pathPrefix) return true
  return path === site.pathPrefix || path.startsWith(`${site.pathPrefix}/`)
}

/**
 * Whether a host belongs to a site, using the same rule as the extension.
 *
 * This is the host-level question only; the full decision, including the page
 * path and ambiguity, is `findSelectorSiteMatch`.
 */
export function hostBelongsToSelectorSite(hostname: string, site: SelectorSiteTarget): boolean {
  const normalized = hostname.trim().toLowerCase()
  if (!normalized) return false
  return site.hosts.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`))
}

/**
 * The site a hostname (and optionally a page path) belongs to.
 *
 * `find()` used to decide this, so a custom site on `foo.chatgpt.com` lost to
 * the built-in ChatGPT entry and two entries on one host were decided by list
 * order. The match is ranked instead: an exact host beats another host of the
 * same site, which beats a host suffix; a more specific entry path beats the
 * host root. A tie between different sites is reported as ambiguous and the
 * caller refuses instead of picking silently.
 */
export function findSelectorSiteMatch(
  hostname: string,
  sites: readonly SelectorSiteTarget[],
  pathname?: string
): SelectorSiteMatch | null {
  const normalized = hostname.trim().toLowerCase()
  if (!normalized) return null

  interface Ranked {
    site: SelectorSiteTarget
    tier: number
    hostLength: number
    pathLength: number
  }

  const ranked: Ranked[] = []
  for (const site of sites) {
    if (!pathBelongsToSelectorSite(pathname, site)) continue
    let tier = -1
    let hostLength = 0
    for (const allowed of site.hosts) {
      if (normalized === allowed) {
        const candidateTier = normalized === site.hostname ? 0 : 1
        if (tier === -1 || candidateTier < tier) {
          tier = candidateTier
          hostLength = allowed.length
        }
        continue
      }
      if (normalized.endsWith(`.${allowed}`)) {
        if (tier === -1 || 2 < tier) {
          tier = 2
          hostLength = allowed.length
        } else if (tier === 2 && allowed.length > hostLength) {
          hostLength = allowed.length
        }
      }
    }
    if (tier < 0) continue
    ranked.push({ site, tier, hostLength, pathLength: site.pathPrefix?.length ?? 0 })
  }

  if (ranked.length === 0) return null
  ranked.sort((left, right) => {
    if (left.tier !== right.tier) return left.tier - right.tier
    if (left.hostLength !== right.hostLength) return right.hostLength - left.hostLength
    return right.pathLength - left.pathLength
  })
  const best = ranked[0]
  // The selector store is keyed by hostname, not by siteId or path. Two sites
  // sharing the same storage hostname cannot keep independent selectors, so
  // both are flagged as ambiguous rather than overwriting each other.
  const storageConflict = sites.some(
    (other) => other.siteId !== best.site.siteId && other.hostname === best.site.hostname
  )
  const ambiguous =
    storageConflict ||
    ranked.some(
      (entry) =>
        entry.tier === best.tier &&
        entry.hostLength === best.hostLength &&
        entry.pathLength === best.pathLength &&
        entry.site.siteId !== best.site.siteId
    )
  return { site: best.site, ambiguous }
}

/** The site a hostname belongs to, or null when the match is absent/ambiguous. */
export function matchSelectorSite(
  hostname: string,
  sites: readonly SelectorSiteTarget[],
  pathname?: string
): SelectorSiteTarget | null {
  const match = findSelectorSiteMatch(hostname, sites, pathname)
  return match && !match.ambiguous ? match.site : null
}

interface SiteStatusConfig {
  health?: string
  input?: unknown
  button?: unknown
  repair?: { input?: unknown; button?: unknown } | null
  lastRepair?: { inputSelector?: string | null; buttonSelector?: string | null } | null
}

/**
 * Resolves the config automation will actually use for `site`, delegating to
 * `resolveConfigForHostname` (exact host -> canonical host -> null) so Side
 * Panel status never shows a subdomain config that automation will not load.
 */
function resolveSiteStatusConfig(
  site: SelectorSiteTarget,
  configs: Readonly<Record<string, SiteStatusConfig>>
): SiteStatusConfig | undefined {
  const normalizedMap: Record<string, SiteStatusConfig> = {}
  for (const [host, config] of Object.entries(configs)) {
    const normalized = host.trim().toLowerCase()
    if (normalized) normalizedMap[normalized] = config
  }
  return resolveConfigForHostname(normalizedMap as AiConfigMap, site.hostname) ?? undefined
}

/** The status of a site's two locators, from the stored config map. */
export function statusOfSite(
  site: SelectorSiteTarget,
  configs: Readonly<Record<string, SiteStatusConfig>>
): SelectorSiteStatus | undefined {
  const config = resolveSiteStatusConfig(site, configs)
  if (!config) return undefined

  const pick = (field: 'input' | 'button'): SelectorSiteStatus['input'] => {
    const selector = typeof config[field] === 'string' ? config[field] : ''
    if (!selector) return 'missing'

    const other: 'input' | 'button' = field === 'input' ? 'button' : 'input'
    const repair = config.repair
    const lastRepair = config.lastRepair
    const thisRepaired = lastRepair?.[`${field}Selector`] === selector
    const otherRepaired =
      typeof config[other] === 'string' && lastRepair?.[`${other}Selector`] === config[other]

    if (config.health === 'needs_repick') {
      if (repair?.[field]) return 'needs_repick'
      if (repair?.[other]) return thisRepaired ? 'repaired' : 'ready'
      return 'unknown'
    }
    if (config.health === 'repaired') {
      if (thisRepaired) return 'repaired'
      if (otherRepaired) return 'ready'
      return 'unknown'
    }
    if (config.health === 'ready' || config.health === 'migrated') {
      return config.health
    }
    return 'unknown'
  }

  return { input: pick('input'), button: pick('button') }
}

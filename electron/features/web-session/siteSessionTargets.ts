/**
 * Session targets: one partition plus one cookie set per site.
 *
 * A target is the unit the rest of the feature works with: imported cookies
 * are written into its partition, a session wipe clears that partition's
 * cookies for its domains, and the settings list renders one row per target.
 *
 * The list is derived from the app's own platform registry, so a built-in
 * platform becomes a session target as soon as it owns a partition and a cookie
 * domain. The Google family is the one exception: its apps share a single
 * partition and therefore share a single row.
 */

import {
  GOOGLE_AI_WEB_SESSION_PARTITION,
  GOOGLE_AI_WEB_SITE_ID,
  GOOGLE_WEB_SESSION_APPS
} from '../../../shared/constants/googleAiWebApps.js'
import { getSiteSessionCookieDomains } from '../../../shared/constants/siteSessionCookieDomains.js'
import type { AiPlatform } from '../../../shared/types/ai.js'
import type { SiteSessionKind, SiteSessionTarget } from '../../../shared/types/siteSession.js'
import { Logger } from '../../core/logger.js'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from '../ai/aiManager.js'
import { readCustomPlatforms } from '../ai/customPlatformStore.js'

/**
 * The apps that make up the Google site.
 *
 * They are excluded from the built-in rows on purpose. Their cookies travel
 * under the `google` site, and a second row on the same partition would split
 * the Google session across two entries — one wipe would clear the other's
 * cookies. The grouping is therefore structural, not a side effect of the
 * cookie domain table.
 */
const GOOGLE_MEMBER_APP_IDS = new Set<string>(GOOGLE_WEB_SESSION_APPS.map((app) => app.id))

/** The origins of the four Google apps: one per app, one partition. */
const GOOGLE_ORIGINS = GOOGLE_WEB_SESSION_APPS.map((app) => new URL(app.url).origin)

/** The hosts of the four Google apps, as the settings row shows them. */
const GOOGLE_HOSTS = GOOGLE_WEB_SESSION_APPS.map((app) => new URL(app.url).hostname).join(', ')

/** A target row plus the fields the renderer needs but the routing does not. */
export interface SiteSessionTargetRow extends SiteSessionTarget {
  /** i18n key of the site label; the renderer resolves it. */
  labelKey: string
  kind: SiteSessionKind
  /** The AI app ids that belong to this site. */
  memberAppIds: string[]
  /**
   * The hosts the settings row shows for this site.
   *
   * A site may live on several hosts — the Google group on four — so this is
   * a label and not an origin: the origins that a wipe clears live in
   * `origins`.
   */
  hostname: string
}

/**
 * The origin of a platform URL, or null when the URL is unusable.
 *
 * A platform without a parsable URL has no site to route cookies to, so it
 * cannot become a target.
 */
function originOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * The hostname of a platform URL, or null when the URL is unusable.
 *
 * A platform without a parsable URL has no site to route cookies to, so it
 * cannot become a target.
 */
function hostnameOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/**
 * One built-in platform as a session target, or null when it cannot be one.
 *
 * A platform is skipped when it belongs to the Google group, when it has no
 * partition (the `api-chat` model has none), when its URL cannot be parsed, or
 * when the cookie domain table holds no domain for it — a site without a
 * domain has no cookie to import.
 */
function buildPlatformTarget(platform: AiPlatform): SiteSessionTargetRow | null {
  if (GOOGLE_MEMBER_APP_IDS.has(platform.id)) return null

  const partition = platform.partition
  if (!partition) return null
  const origin = originOf(platform.url)
  const hostname = hostnameOf(platform.url)
  if (!origin || !hostname) {
    // An absent URL is a configuration choice (the `api-chat` model has none),
    // but an unparsable one is a defect: the site would disappear from the
    // settings list without a trace.
    if (platform.url) {
      Logger.warn(
        `[Web Session] The platform "${platform.id}" is skipped: its url cannot be parsed.`
      )
    }
    return null
  }
  const cookieDomains = getSiteSessionCookieDomains(platform.id)
  if (cookieDomains.length === 0) return null

  return {
    siteId: platform.id,
    hostname,
    origins: [origin],
    partition,
    cookieDomains,
    labelKey: `ws_target_${platform.id}`,
    kind: 'builtin',
    memberAppIds: [platform.id]
  }
}

/** Every site the app ships with: the Google group plus the built-in platforms. */
export function buildBuiltinSiteSessionTargets(): SiteSessionTargetRow[] {
  const targets: SiteSessionTargetRow[] = [
    {
      siteId: GOOGLE_AI_WEB_SITE_ID,
      hostname: GOOGLE_HOSTS,
      origins: GOOGLE_ORIGINS,
      partition: GOOGLE_AI_WEB_SESSION_PARTITION,
      cookieDomains: getSiteSessionCookieDomains(GOOGLE_AI_WEB_SITE_ID),
      labelKey: 'ws_target_google',
      kind: 'google',
      memberAppIds: GOOGLE_WEB_SESSION_APPS.map((app) => app.id)
    }
  ]

  for (const platform of [...Object.values(AI_REGISTRY), ...Object.values(INACTIVE_PLATFORMS)]) {
    const target = buildPlatformTarget(platform)
    if (target) targets.push(target)
  }

  return targets
}

/**
 * Every site session target: the built-in sites plus the user-added ones.
 *
 * A user-added platform only becomes a site when it was added as one; the
 * API-only custom models are not browsable and have nothing to import.
 */
export async function buildSiteSessionTargets(): Promise<SiteSessionTargetRow[]> {
  const targets = buildBuiltinSiteSessionTargets()
  const customPlatforms = await readCustomPlatforms()

  for (const [id, platform] of Object.entries(customPlatforms)) {
    if (!platform.isSite) continue
    const partition = platform.partition
    if (!partition) {
      Logger.warn(`[Web Session] The custom site "${id}" is skipped: it has no partition.`)
      continue
    }
    const origin = originOf(platform.url)
    const hostname = hostnameOf(platform.url)
    if (!origin || !hostname) {
      Logger.warn(`[Web Session] The custom site "${id}" is skipped: it has no usable url.`)
      continue
    }

    targets.push({
      siteId: `custom:${id}`,
      hostname,
      origins: [origin],
      partition,
      cookieDomains: [`.${hostname}`],
      labelKey: 'ws_target_custom',
      kind: 'custom',
      memberAppIds: [platform.id]
    })
  }

  return targets
}

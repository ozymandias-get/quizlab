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
  GOOGLE_WEB_SESSION_APPS
} from '../../../shared/constants/googleAiWebApps.js'
import { getSiteSessionCookieDomains } from '../../../shared/constants/siteSessionCookieDomains.js'
import type { AiPlatform } from '../../../shared/types/ai.js'
import type {
  SiteSessionKind,
  SiteSessionStatusCode,
  SiteSessionTarget,
  SiteSessionView
} from '../../../shared/types/siteSession.js'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from '../ai/aiManager.js'
import { readCustomPlatforms } from '../ai/customPlatformStore.js'

/** The Google family: many apps, one partition, one settings row. */
const GOOGLE_SITE_ID = 'google'
const GOOGLE_HOSTNAME = 'accounts.google.com'

/** A target row plus the fields the renderer needs but the routing does not. */
export interface SiteSessionTargetRow extends SiteSessionTarget {
  /** i18n key of the site label; the renderer resolves it. */
  labelKey: string
  kind: SiteSessionKind
  /** The AI app ids that belong to this site. */
  memberAppIds: string[]
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
 * A platform is skipped when it has no partition (the `api-chat` model has
 * none), when its URL cannot be parsed, or when the cookie domain table holds
 * no domain for it — a site without a domain has no cookie to import. The
 * Google-managed platforms are skipped by that last rule: their cookies are
 * keyed under `google`, which owns the shared partition.
 */
function buildPlatformTarget(platform: AiPlatform): SiteSessionTargetRow | null {
  const partition = platform.partition
  if (!partition) return null
  const hostname = hostnameOf(platform.url)
  if (!hostname) return null
  const cookieDomains = getSiteSessionCookieDomains(platform.id)
  if (cookieDomains.length === 0) return null

  return {
    siteId: platform.id,
    hostname,
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
      siteId: GOOGLE_SITE_ID,
      hostname: GOOGLE_HOSTNAME,
      partition: GOOGLE_AI_WEB_SESSION_PARTITION,
      cookieDomains: getSiteSessionCookieDomains(GOOGLE_SITE_ID),
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
    if (!partition) continue
    const hostname = hostnameOf(platform.url)
    if (!hostname) continue

    targets.push({
      siteId: `custom:${id}`,
      hostname,
      partition,
      cookieDomains: [`.${hostname}`],
      labelKey: 'ws_target_custom',
      kind: 'custom',
      memberAppIds: [platform.id]
    })
  }

  return targets
}

/**
 * The renderer-facing view of a target.
 *
 * The partition is main-process state and stays out of the view; the member
 * app ids are copied so a caller cannot mutate the target through the view.
 */
export function toSiteSessionView(
  target: SiteSessionTargetRow,
  enabled: boolean,
  status: SiteSessionStatusCode,
  importedAt: string | null,
  lastError: string | null
): SiteSessionView {
  return {
    siteId: target.siteId,
    labelKey: target.labelKey,
    hostname: target.hostname,
    kind: target.kind,
    memberAppIds: [...target.memberAppIds],
    enabled,
    status,
    importedAt,
    lastError
  }
}

import { type Session, session } from 'electron'

import {
  GOOGLE_AI_WEB_SESSION_PARTITION,
  GOOGLE_AI_WEB_SITE_ID
} from '../../../shared/constants/googleAiWebApps.js'
import { SITE_SESSION_COOKIE_DOMAINS } from '../../../shared/constants/siteSessionCookieDomains.js'
import { isSiteSessionSlot } from '../../../shared/constants/siteSessionSlots.js'
import { broadcastSiteSessionsChanged } from './siteSessionBroadcast.js'
import { getSiteSessionConfig, type SiteSessionConfig } from './siteSessionConfig.js'
import { isCookieDomainAllowed } from './siteSessionCookies.js'
import { type ExternalBrowserCookie, importExternalCookies } from './siteSessionImporter.js'
import { invalidateSiteSessionListCache } from './siteSessionListCache.js'
import { withSiteSessionLock } from './siteSessionLock.js'
import { partitionForTargetSlot } from './siteSessionTargets.js'

interface GoogleSlotEnvironment {
  config: Pick<SiteSessionConfig, 'isEnabled' | 'recordResult' | 'read'>
  resolveSession: (partition: string) => Session
}

const AUTH_COOKIES = new Set(['SID', '__Secure-1PSID', '__Secure-3PSID'])
const SAME_SITE: Record<string, ExternalBrowserCookie['sameSite']> = {
  unspecified: 'Unspecified',
  no_restriction: 'None',
  lax: 'Lax',
  strict: 'Strict'
}

function isGoogleAuthCookie(cookie: Electron.Cookie): boolean {
  return AUTH_COOKIES.has(cookie.name) && isCookieDomainAllowed(cookie.domain, ['.google.com'])
}

/**
 * A single Chrome import already contains every signed-in Google account.
 * Seed an unsigned secondary app session from that bundle on first use.
 * Never replace an existing authenticated secondary session.
 */
export async function ensureGoogleSessionSlot(
  slot: number,
  environment?: GoogleSlotEnvironment
): Promise<void> {
  if (!isSiteSessionSlot(slot) || slot === 1) return
  const config = environment?.config ?? getSiteSessionConfig()
  if (!(await config.isEnabled(GOOGLE_AI_WEB_SITE_ID))) return
  const resolveSession =
    environment?.resolveSession ?? ((partition: string) => session.fromPartition(partition))
  await withSiteSessionLock(GOOGLE_AI_WEB_SITE_ID, async () => {
    // Re-check after acquiring the same lock used by import and sign-out.
    if (!(await config.isEnabled(GOOGLE_AI_WEB_SITE_ID))) return
    const destination = resolveSession(
      partitionForTargetSlot(GOOGLE_AI_WEB_SESSION_PARTITION, slot)
    )
    const existing = await destination.cookies.get({})
    const state = await config.read()
    const histories = state.targets[GOOGLE_AI_WEB_SITE_ID]?.slots
    const sourceTime = histories?.[1]?.importedAt
    const destinationTime = histories?.[slot]?.importedAt
    const sourceWasUpdated =
      sourceTime && destinationTime && Date.parse(sourceTime) > Date.parse(destinationTime)
    if (existing.some(isGoogleAuthCookie) && !sourceWasUpdated) return
    const source = resolveSession(GOOGLE_AI_WEB_SESSION_PARTITION)
    const cookies = (await source.cookies.get({})).filter((cookie) =>
      isCookieDomainAllowed(cookie.domain, SITE_SESSION_COOKIE_DOMAINS.google)
    )
    if (!cookies.some(isGoogleAuthCookie)) return
    const result = await importExternalCookies(
      destination,
      cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain ?? '',
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: SAME_SITE[cookie.sameSite],
        expires: cookie.expirationDate
      })),
      SITE_SESSION_COOKIE_DOMAINS.google
    )
    const imported = result.imported > 0 && result.failed === 0
    await config.recordResult(
      GOOGLE_AI_WEB_SITE_ID,
      imported ? 'imported' : 'failed',
      imported ? undefined : 'import_failed',
      slot
    )
    invalidateSiteSessionListCache()
    await broadcastSiteSessionsChanged()
  })
}

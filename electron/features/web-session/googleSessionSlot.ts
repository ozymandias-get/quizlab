import { type Session, session } from 'electron'

import {
  GOOGLE_AI_WEB_SESSION_PARTITION,
  GOOGLE_AI_WEB_SITE_ID
} from '../../../shared/constants/googleAiWebApps.js'
import { SITE_SESSION_COOKIE_DOMAINS } from '../../../shared/constants/siteSessionCookieDomains.js'
import { isSiteSessionSlot } from '../../../shared/constants/siteSessionSlots.js'
import { Logger } from '../../core/logger.js'
import { broadcastSiteSessionsChanged } from './siteSessionBroadcast.js'
import { getSiteSessionConfig, type SiteSessionConfig } from './siteSessionConfig.js'
import { cookieRemovalUrls, domainHost, isCookieDomainAllowed } from './siteSessionCookies.js'
import { type ExternalBrowserCookie, importExternalCookies } from './siteSessionImporter.js'
import { invalidateSiteSessionListCache } from './siteSessionListCache.js'
import { withSiteSessionLock } from './siteSessionLock.js'
import { partitionForTargetSlot } from './siteSessionTargets.js'

interface GoogleSlotEnvironment {
  config: Pick<SiteSessionConfig, 'isEnabled' | 'recordResult' | 'read'>
  resolveSession: (partition: string) => Session
}

/**
 * What preparing a secondary Google partition produced.
 *
 * `ok: false` means the destination is not safe to select: the import failed
 * and the previous cookies were restored as far as the cookie store allowed.
 * `no_source` is not a failure: there is simply no Google login in the primary
 * partition to copy yet, so the next import will seed the slot.
 */
export type GoogleSlotPreparationResult =
  | { ok: true; status: 'ready' | 'imported' | 'no_source' | 'disabled' }
  | { ok: false; status: 'import_failed'; imported: number; failed: number }

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

/** The browser-shaped cookie the importer reads, from an Electron cookie. */
function toExternalCookie(cookie: Electron.Cookie): ExternalBrowserCookie {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.hostOnly
      ? domainHost(cookie.domain ?? '')
      : cookie.hostOnly === false && cookie.domain
        ? `.${domainHost(cookie.domain)}`
        : (cookie.domain ?? ''),
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: SAME_SITE[cookie.sameSite],
    expires: cookie.expirationDate
  }
}

/** Best-effort rollback: removes every Google cookie the target holds. */
async function clearGoogleCookies(targetSession: Session): Promise<boolean> {
  const existing = await targetSession.cookies.get({})
  let failed = false
  for (const cookie of existing) {
    if (!isCookieDomainAllowed(cookie.domain, SITE_SESSION_COOKIE_DOMAINS.google)) continue
    for (const url of cookieRemovalUrls(cookie.domain, cookie.path, cookie.secure)) {
      try {
        await targetSession.cookies.remove(url, cookie.name)
      } catch {
        failed = true
      }
    }
  }
  return !failed
}

/**
 * A single Chrome import already contains every signed-in Google account.
 * Seed an unsigned secondary app session from that bundle on first use.
 * Never replace an existing authenticated secondary session.
 */
export async function ensureGoogleSessionSlot(
  slot: number,
  environment?: GoogleSlotEnvironment
): Promise<GoogleSlotPreparationResult> {
  if (!isSiteSessionSlot(slot) || slot === 1) return { ok: true, status: 'ready' }
  const config = environment?.config ?? getSiteSessionConfig()
  if (!(await config.isEnabled(GOOGLE_AI_WEB_SITE_ID))) return { ok: true, status: 'disabled' }
  return withSiteSessionLock(GOOGLE_AI_WEB_SITE_ID, () =>
    seedGoogleSessionSlotUnderLock(slot, environment)
  )
}

export async function seedGoogleSessionSlotUnderLock(
  slot: number,
  environment?: GoogleSlotEnvironment
): Promise<GoogleSlotPreparationResult> {
  if (!isSiteSessionSlot(slot) || slot === 1) return { ok: true, status: 'ready' }
  const config = environment?.config ?? getSiteSessionConfig()
  if (!(await config.isEnabled(GOOGLE_AI_WEB_SITE_ID))) return { ok: true, status: 'disabled' }
  const resolveSession =
    environment?.resolveSession ?? ((partition: string) => session.fromPartition(partition))
  const destination = resolveSession(partitionForTargetSlot(GOOGLE_AI_WEB_SESSION_PARTITION, slot))
  const existing = await destination.cookies.get({})
  const state = await config.read()
  const histories = state.targets[GOOGLE_AI_WEB_SITE_ID]?.slots
  const sourceTime = histories?.[1]?.importedAt
  const destinationTime = histories?.[slot]?.importedAt
  const sourceWasUpdated =
    sourceTime && destinationTime && Date.parse(sourceTime) > Date.parse(destinationTime)
  if (existing.some(isGoogleAuthCookie) && !sourceWasUpdated) {
    return { ok: true, status: 'ready' }
  }
  const source = resolveSession(GOOGLE_AI_WEB_SESSION_PARTITION)
  const cookies = (await source.cookies.get({})).filter((cookie) =>
    isCookieDomainAllowed(cookie.domain, SITE_SESSION_COOKIE_DOMAINS.google)
  )
  if (!cookies.some(isGoogleAuthCookie)) {
    return { ok: true, status: 'no_source' }
  }

  // The new import replaces the catalog of Google cookies. Keep a snapshot so
  // a partial write can be rolled back instead of leaving a mix of the old
  // and the new session that neither Google nor the user expects.
  const snapshot = existing
    .filter((cookie) => isCookieDomainAllowed(cookie.domain, SITE_SESSION_COOKIE_DOMAINS.google))
    .map(toExternalCookie)

  const result = await importExternalCookies(
    destination,
    cookies.map(toExternalCookie),
    SITE_SESSION_COOKIE_DOMAINS.google
  )
  const imported = result.imported > 0 && result.failed === 0

  if (!imported) {
    let restored = false
    try {
      const cleared = await clearGoogleCookies(destination)
      const restoredImport = await importExternalCookies(
        destination,
        snapshot,
        SITE_SESSION_COOKIE_DOMAINS.google
      )
      restored = cleared && restoredImport.failed === 0
    } catch (error) {
      Logger.warn('[SiteSession] The previous Google session could not be restored:', error)
    }
    Logger.warn(
      `[SiteSession] Google slot ${slot} was not selected: the import failed ` +
        `(${result.imported} written, ${result.failed} failed; restored=${restored}).`
    )
    try {
      await config.recordResult(GOOGLE_AI_WEB_SITE_ID, 'failed', 'import_failed', slot)
    } catch (error) {
      Logger.warn('[SiteSession] The Google account import result could not be recorded:', error)
    }
    invalidateSiteSessionListCache()
    await broadcastSiteSessionsChanged()
    return {
      ok: false,
      status: 'import_failed',
      imported: result.imported,
      failed: result.failed
    }
  }

  try {
    await config.recordResult(GOOGLE_AI_WEB_SITE_ID, 'imported', undefined, slot)
  } catch (error) {
    Logger.warn('[SiteSession] The Google account import result could not be recorded:', error)
  }
  invalidateSiteSessionListCache()
  await broadcastSiteSessionsChanged()
  return { ok: true, status: 'imported' }
}

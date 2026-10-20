/**
 * The main-process core of the site session bridge.
 *
 * The Chrome extension talks to the app over a loopback HTTP bridge. This
 * module holds the two things that bridge needs from the app:
 *
 *   - the list of sites whose session may be taken from Chrome, and
 *   - the handling of a packet the extension sends for one of those sites.
 *
 * Both the HTTP bridge and the renderer-facing service go through here, so a
 * packet is accepted or refused by the same rules no matter which door it
 * came in.
 */

import type { ChromeExtensionCookie } from '@shared-core/types'

import { type Session, session as electronSession } from 'electron'

import { Logger } from '../../core/logger.js'
import { getSiteSessionConfig, type SiteSessionConfig } from './siteSessionConfig.js'
import type {
  CookiePacket,
  CookiePacketRejection,
  CookiePacketStatus
} from './siteSessionCookieRouter.js'
import { routeCookiePacket } from './siteSessionCookieRouter.js'
import { type ExternalBrowserCookie, importExternalCookies } from './siteSessionImporter.js'
import { buildSiteSessionTargets, type SiteSessionTargetRow } from './siteSessionTargets.js'

/**
 * The protocol the extension and the app agree on.
 *
 * The version travels with every answer so that an extension the user has
 * not reloaded — an unpacked copy whose host permissions are still the old
 * ones — can be told apart from a browser that simply holds no cookies.
 */
export const SITE_SESSION_PROTOCOL_VERSION = 2

/** One site the extension may read cookies for. */
interface SiteSessionBridgeTarget {
  siteId: string
  cookieDomains: string[]
}

/**
 * The parts of the app a packet is handled in.
 *
 * The defaults are the app's own: the shared config, the target list and the
 * Electron sessions. A caller that works on a state of its own — the
 * renderer-facing service, which knows its own config and its own sessions —
 * passes them in instead of letting the bridge reach for the singletons.
 */
export interface SiteSessionImportEnvironment {
  /** The persisted state of the import switches. */
  config: Pick<SiteSessionConfig, 'read' | 'recordResult'>
  /** The sites the app knows about. */
  loadTargets: () => Promise<SiteSessionTargetRow[]>
  /** The session of a partition. */
  resolveSession: (partition: string) => Session
}

/** The session of a partition, as the app itself resolves it. */
function defaultResolveSession(partition: string): Session {
  return electronSession.fromPartition(partition)
}

/** The answer to the extension's question "which sites should I push?". */
export interface SiteSessionBridgeList {
  protocolVersion: number
  configVersion: number
  targets: SiteSessionBridgeTarget[]
}

/**
 * The wire vocabulary of the extension and the one of the importer differ.
 *
 * Chrome names the SameSite attribute in lower case (`no_restriction`), the
 * importer names it the way Electron does (`None`). The difference is
 * translated here, at the boundary, so that neither side has to know about
 * the other's spelling — and so that a cookie that arrives with an unknown
 * attribute keeps its default instead of silently changing meaning.
 */
const SAME_SITE_FROM_CHROME: Record<string, ExternalBrowserCookie['sameSite']> = {
  strict: 'Strict',
  lax: 'Lax',
  no_restriction: 'None',
  unspecified: 'Unspecified'
}

/** The importer's shape of a cookie the extension sent. */
function toImporterCookie(cookie: ChromeExtensionCookie): ExternalBrowserCookie {
  const sameSite = cookie.sameSite ? SAME_SITE_FROM_CHROME[cookie.sameSite] : undefined
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    sameSite,
    expires: cookie.expires
  }
}

/** The outcome of a packet the extension sent. */
export interface SiteSessionPacketOutcome {
  accepted: boolean
  reason?: CookiePacketRejection
  imported?: number
  failed?: number
}

const COOKIE_PACKET_STATUSES: ReadonlySet<string> = new Set([
  'ok',
  'no_cookies',
  'permission_missing'
])

/** The SameSite values Chrome reports. */
const SAME_SITE_VALUES: ReadonlySet<string> = new Set([
  'strict',
  'lax',
  'no_restriction',
  'unspecified'
])

/** A cookie of the shape the extension sends. */
function isBrowserCookie(value: unknown): value is ChromeExtensionCookie {
  if (typeof value !== 'object' || value === null) return false
  const cookie = value as Partial<ChromeExtensionCookie>
  if (typeof cookie.name !== 'string' || typeof cookie.value !== 'string') return false
  if (cookie.sameSite !== undefined && !SAME_SITE_VALUES.has(cookie.sameSite)) return false
  return true
}

/**
 * Reads a cookie packet out of an untrusted body.
 *
 * Every field is checked before it reaches the rest of the app: a packet has
 * to name exactly one site and carry a status the app knows. A packet that
 * does not is refused here rather than deeper in.
 */
export function parseSiteSessionPacket(body: string): CookiePacket | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const candidate = parsed as { targetId?: unknown; status?: unknown; cookies?: unknown }
  if (typeof candidate.targetId !== 'string' || candidate.targetId.length === 0) return null
  if (typeof candidate.status !== 'string' || !COOKIE_PACKET_STATUSES.has(candidate.status)) {
    return null
  }
  if (!Array.isArray(candidate.cookies)) return null

  const cookies = candidate.cookies.filter(isBrowserCookie)
  if (cookies.length !== candidate.cookies.length) return null

  return {
    targetId: candidate.targetId,
    status: candidate.status as CookiePacketStatus,
    cookies
  }
}

/** The sites whose session may be taken from Chrome right now. */
export async function listEnabledSiteSessionTargets(): Promise<SiteSessionBridgeList> {
  const config = getSiteSessionConfig()
  const [state, targets] = await Promise.all([config.read(), buildSiteSessionTargets()])

  const enabledTargets = targets
    .filter((target) => state.targets[target.siteId]?.enabled === true)
    .map((target) => ({
      siteId: target.siteId,
      cookieDomains: [...target.cookieDomains]
    }))

  return {
    protocolVersion: SITE_SESSION_PROTOCOL_VERSION,
    configVersion: state.configVersion,
    targets: enabledTargets
  }
}

/**
 * Whether the app already holds a session for this site.
 *
 * The switch may be off — the user may have logged into the site inside the
 * app instead — and the row then says "logged in" rather than "logged out".
 *
 * The session is resolved by the caller so that a caller which works on a
 * state of its own reads the session it knows about.
 */
export async function hasLocalSessionForTarget(
  target: SiteSessionTargetRow,
  resolveSession: (partition: string) => Session = defaultResolveSession
): Promise<boolean> {
  const targetSession = resolveSession(target.partition)
  const cookies = await targetSession.cookies.get({}).catch(() => [])
  return cookies.some((cookie) => {
    const cookieHost = (cookie.domain ?? '').replace(/^\.+/, '').toLowerCase()
    if (!cookieHost) return false
    return target.cookieDomains.some((allowed) => {
      const allowedHost = allowed.replace(/^\.+/, '').toLowerCase()
      if (!allowedHost) return false
      return cookieHost === allowedHost || cookieHost.endsWith(`.${allowedHost}`)
    })
  })
}

/**
 * The earliest expiry among the cookies of a packet, as an ISO timestamp.
 *
 * Informational only: it tells the settings row when the session the app
 * holds is likely to expire. A cookie without an expiry is a session cookie
 * and does not shorten the estimate.
 */
function earliestExpiryIso(cookies: CookiePacket['cookies']): string | null {
  const expiries = cookies
    .map((cookie) => cookie.expires)
    .filter((expires): expires is number => typeof expires === 'number' && Number.isFinite(expires))
    .filter((expires) => expires > 0)
    .map((expires) => (expires > 1e12 ? Math.floor(expires / 1000) : Math.floor(expires)))

  if (expiries.length === 0) return null
  return new Date(Math.min(...expiries) * 1000).toISOString()
}

/**
 * Handles one packet from the extension.
 *
 * The packet is refused whole unless it belongs to a site that is switched on
 * and every cookie in it belongs to that site. A refused packet writes
 * nothing and changes nothing.
 *
 * A packet that reports no cookies — or no permission — is not a failure: it
 * only records what the extension saw. The session the user may already have
 * inside the app is left alone.
 */
export async function acceptSiteSessionPacket(
  packet: CookiePacket,
  environment?: SiteSessionImportEnvironment
): Promise<SiteSessionPacketOutcome> {
  const config = environment?.config ?? getSiteSessionConfig()
  const loadTargets = environment?.loadTargets ?? buildSiteSessionTargets
  const resolveSession = environment?.resolveSession ?? defaultResolveSession
  const [state, targets] = await Promise.all([config.read(), loadTargets()])

  const enabledSiteIds = new Set(
    Object.entries(state.targets)
      .filter(([, targetState]) => targetState.enabled)
      .map(([siteId]) => siteId)
  )

  const routed = routeCookiePacket(packet, targets, (siteId) => enabledSiteIds.has(siteId))
  if (!routed.ok) {
    Logger.warn(`[SiteSessionBridge] Refused a packet: ${routed.reason}.`)
    return { accepted: false, reason: routed.reason }
  }

  const { target } = routed

  if (packet.status !== 'ok') {
    const result = packet.status === 'permission_missing' ? 'permission_missing' : 'no_cookies'
    await recordResult(config, target.siteId, result)
    return { accepted: true }
  }

  const targetSession = resolveSession(target.partition)
  const { imported, failed } = await importExternalCookies(
    targetSession,
    packet.cookies.map(toImporterCookie),
    target.cookieDomains
  )

  await recordResult(
    config,
    target.siteId,
    imported > 0 ? 'imported' : 'failed',
    undefined,
    earliestExpiryIso(packet.cookies)
  )

  return { accepted: true, imported, failed }
}

/**
 * Records the outcome of an import.
 *
 * A state file that cannot be written must not take the bridge down with it:
 * the import itself already happened, and the row in the settings shows the
 * outcome of the *last* import, not a promise about the next one.
 */
async function recordResult(
  config: Pick<SiteSessionConfig, 'recordResult'>,
  siteId: string,
  result: 'imported' | 'no_cookies' | 'permission_missing' | 'failed',
  error?: string,
  expiresAt?: string | null
): Promise<void> {
  try {
    await config.recordResult(siteId, result, error, expiresAt)
  } catch (writeError) {
    Logger.warn(
      `[SiteSessionBridge] The result of "${siteId}" could not be recorded: ` +
        `${writeError instanceof Error ? writeError.message : String(writeError)}`
    )
  }
}

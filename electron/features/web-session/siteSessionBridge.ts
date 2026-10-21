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
import { broadcastSiteSessionsChanged } from './siteSessionBroadcast.js'
import { getSiteSessionConfig, type SiteSessionConfig } from './siteSessionConfig.js'
import type {
  CookiePacket,
  CookiePacketRejection,
  CookiePacketStatus
} from './siteSessionCookieRouter.js'
import { routeCookiePacket } from './siteSessionCookieRouter.js'
import { type ExternalBrowserCookie, importExternalCookies } from './siteSessionImporter.js'
import { invalidateSiteSessionListCache } from './siteSessionListCache.js'
import { withSiteSessionLock } from './siteSessionLock.js'
import { partitionExistsOnDisk } from './siteSessionPartitions.js'
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
  /**
   * The sites of the round the packet belongs to.
   *
   * A round of packets shares one target list: the sites of a round do not
   * change while the extension pushes them, so the list is built once for
   * the round instead of once for every packet.
   */
  targets?: SiteSessionTargetRow[]
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
 * One round of packets from the extension.
 *
 * The extension pushes one packet per site, and the sites of a round do not
 * change while it pushes them: the target list is built once for the round
 * and shared by its packets, so a round with N sites reads the list once
 * instead of N times.
 *
 * The round has no lifetime of its own: the site list request opens the next
 * one, and the packets of a round arrive right after it.
 */
export interface SiteSessionRound {
  /** The sites of the round: one partition and one cookie set per site. */
  readonly targets: SiteSessionTargetRow[]
  /** Handles one packet of the round. */
  accept(packet: CookiePacket): Promise<SiteSessionPacketOutcome>
}

/**
 * Opens a round of packets.
 *
 * The caller that serves a round — the HTTP bridge — keeps the round and
 * hands it to every packet of the round. The stdio path handles one packet
 * at a time, so it has nothing to share and opens no round.
 */
export async function openSiteSessionRound(
  environment?: SiteSessionImportEnvironment
): Promise<SiteSessionRound> {
  const config = environment?.config ?? getSiteSessionConfig()
  const loadTargets = environment?.loadTargets ?? buildSiteSessionTargets
  const resolveSession = environment?.resolveSession ?? defaultResolveSession

  const targets = await loadTargets()

  return {
    targets,
    accept: (packet) =>
      acceptSiteSessionPacket(packet, { config, loadTargets, resolveSession, targets })
  }
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

/**
 * The sites whose session may be taken from Chrome right now.
 *
 * The round that is given brings the target list with it: the extension is
 * told about the sites of the round and pushes a packet for every one of
 * them, so the list is read once for the whole round.
 */
export async function listEnabledSiteSessionTargets(
  round?: SiteSessionRound
): Promise<SiteSessionBridgeList> {
  const config = getSiteSessionConfig()
  const [state, targets] = await Promise.all([
    config.read(),
    round ? Promise.resolve(round.targets) : buildSiteSessionTargets()
  ])

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
 * A partition that was never used holds no session, and asking Electron for
 * it would create it: a user who never opened a platform should not get an
 * empty `persist:ai_*` folder for it. The check is skipped for such a
 * partition.
 *
 * The session is resolved by the caller so that a caller which works on a
 * state of its own reads the session it knows about.
 */
export async function hasLocalSessionForTarget(
  target: SiteSessionTargetRow,
  resolveSession: (partition: string) => Session = defaultResolveSession
): Promise<boolean> {
  if (!(await partitionExistsOnDisk(target.partition))) return false

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
 * Handles one packet from the extension.
 *
 * The packet is refused whole unless it belongs to a site that is switched on
 * and every cookie in it belongs to that site. A refused packet writes
 * nothing and changes nothing.
 *
 * The switch is read twice: once for the routing, and once more right
 * before the import. The second read is what makes the race small: a packet
 * that arrives after the user turned the site off is refused, and only an
 * import that is already running can still finish after the wipe.
 *
 * The whole handling runs under the lock of the site, so that a switch that
 * is turned off while the packet is on its way waits for the import and
 * wipes afterwards: the session the user cancelled cannot come back.
 *
 * A packet that reports no cookies — or no permission — is not a failure: it
 * only records what the extension saw. The session the user may already have
 * inside the app is left alone.
 */
export async function acceptSiteSessionPacket(
  packet: CookiePacket,
  environment?: SiteSessionImportEnvironment
): Promise<SiteSessionPacketOutcome> {
  const outcome = await withSiteSessionLock(packet.targetId, () =>
    handleSiteSessionPacket(packet, environment)
  )

  if (outcome.accepted) {
    // The import changed what the settings row shows, so the list that is
    // kept is dropped before the fresh one is sent.
    invalidateSiteSessionListCache()

    // The renderer has to learn that an import happened: without the event the
    // row keeps the state it had and the feature looks like it did nothing.
    await broadcastSiteSessionsChanged()
  }

  return outcome
}

/** The handling of one packet, under the lock of its site. */
async function handleSiteSessionPacket(
  packet: CookiePacket,
  environment?: SiteSessionImportEnvironment
): Promise<SiteSessionPacketOutcome> {
  const config = environment?.config ?? getSiteSessionConfig()
  const loadTargets = environment?.loadTargets ?? buildSiteSessionTargets
  const resolveSession = environment?.resolveSession ?? defaultResolveSession

  // The targets are built first and the switch state is read afterwards: the
  // snapshot has to be as late as possible, because the router asks the
  // question "is this site switched on?" synchronously. The targets of a
  // round are the ones the round was opened with: they do not have to be
  // built again for every packet of the round.
  const targets = environment?.targets ?? (await loadTargets())
  const state = await config.read()

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

  // The switch is read once more right before the import: the user may have
  // turned the site off while the packet was on its way, and a session that
  // is written after that would outlive the wipe that follows the switch.
  if (!(await isStillEnabled(config, target.siteId))) {
    Logger.warn(`[SiteSessionBridge] Refused a packet: the switch of "${target.siteId}" is off.`)
    return { accepted: false, reason: 'target_disabled' }
  }

  const targetSession = resolveSession(target.partition)
  const { imported, failed } = await importExternalCookies(
    targetSession,
    packet.cookies.map(toImporterCookie),
    target.cookieDomains
  )

  // An import that wrote nothing is a failure the user has to see: without a
  // reason code the row would show the outcome without saying what went wrong,
  // and `lastError` would stay empty.
  const wroteSomething = imported > 0
  await recordResult(
    config,
    target.siteId,
    wroteSomething ? 'imported' : 'failed',
    wroteSomething ? undefined : 'import_failed'
  )

  return { accepted: true, imported, failed }
}

/**
 * Whether the site is still switched on.
 *
 * The state is read from the disk again: the file is the truth, and a switch
 * that was turned in the meantime has to be seen before a cookie is written.
 */
async function isStillEnabled(
  config: Pick<SiteSessionConfig, 'read'>,
  siteId: string
): Promise<boolean> {
  const state = await config.read()
  return state.targets[siteId]?.enabled === true
}

/**
 * The reason code a packet that does not fit into the bridge is recorded with.
 *
 * The code is a plain string: the renderer shows the code of the `lastError`
 * through the `ws_error_*` keys, and the key of this one comes with the
 * translation of the code.
 */
export const PACKET_TOO_LARGE = 'packet_too_large'

/**
 * Records that the packet of a site did not fit into the bridge.
 *
 * Nothing was imported: the packet was larger than the bridge reads, so it
 * could not even be looked at. The row of the site says so instead of showing
 * the outcome of an earlier import, and the renderer hears about it because
 * the row of the site changed.
 */
export async function recordOversizedSiteSessionPacket(siteId: string): Promise<void> {
  await recordResult(getSiteSessionConfig(), siteId, 'failed', PACKET_TOO_LARGE)
  await broadcastSiteSessionsChanged()
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
  error?: string
): Promise<void> {
  try {
    await config.recordResult(siteId, result, error)
  } catch (writeError) {
    Logger.warn(
      `[SiteSessionBridge] The result of "${siteId}" could not be recorded: ` +
        `${writeError instanceof Error ? writeError.message : String(writeError)}`
    )
  }
}

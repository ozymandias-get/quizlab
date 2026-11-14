import crypto from 'crypto'
import { app } from 'electron'
import type { IncomingMessage, ServerResponse } from 'http'

import { DEV_SERVER_ORIGIN } from '../../app/window/environment.js'
import { Logger } from '../../core/logger.js'
import {
  listEnabledSiteSessionTargets,
  openSiteSessionRound,
  PACKET_TOO_LARGE,
  parseSiteSessionPacket,
  recordOversizedSiteSessionPacket,
  SITE_SESSION_PROTOCOL_VERSION,
  type SiteSessionRound
} from '../web-session/siteSessionBridge.js'
import type { BridgeOriginPolicy } from './nativeMessagingOrigin.js'
import { isAllowedBridgeOrigin } from './nativeMessagingOrigin.js'
import { isProfileId, normalizeProfileName } from './nativeMessagingProfiles.js'
import { MAX_COOKIE_BODY_SIZE } from './nativeMessagingTypes.js'

/** The payload the extension signs when it asks for the site list. */
const SITE_LIST_SIGNING_PAYLOAD = '/api/sites'

/** The headers that identify the Chrome profile an extension instance runs in. */
const PROFILE_ID_HEADER = 'x-quizlab-profile-id'
const PROFILE_NAME_HEADER = 'x-quizlab-profile-name'

/**
 * The status a packet that does not fit into the bridge is answered with.
 *
 * The status tells the extension that the packet was too large: a broken
 * connection would look like a network that is down, and the extension would
 * push the same packet again and again.
 */
const STATUS_PACKET_TOO_LARGE = 413

function getOriginPolicy(manager: unknown): BridgeOriginPolicy {
  const isDev = !app.isPackaged
  return {
    expectedExtensionOrigin: (manager as unknown as { _expectedExtensionOrigin: string | null })
      ._expectedExtensionOrigin,
    allowedDevOrigins: isDev && DEV_SERVER_ORIGIN ? [DEV_SERVER_ORIGIN] : [],
    isDev
  }
}

function rejectDisallowedOrigin(res: ServerResponse, origin: string | undefined): void {
  Logger.warn(`[NativeMessaging] Rejected request from disallowed origin: ${origin || '(none)'}`)
  res.writeHead(403, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Forbidden' }))
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * The protocol version the extension names in its requests.
 *
 * The header is the extension's own answer to "which protocol do you speak?".
 * A request without it comes from an extension that predates the handshake.
 */
function readProtocolVersion(header: string | string[] | undefined): number | null {
  const raw = Array.isArray(header) ? header[0] : header
  if (typeof raw !== 'string') return null
  const parsed = Number(raw.trim())
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

interface RequestProfile {
  id: string | undefined
  name: string
}

/**
 * The Chrome profile that made the request.
 *
 * The id is generated and persisted by the extension itself; Chrome gives each
 * profile its own `chrome.storage.local`, so two profiles never share one. The
 * name is display data the user typed in the popup and is URL-encoded because
 * it may contain Turkish characters.
 */
function readRequestProfile(req: IncomingMessage): RequestProfile {
  const rawId = req.headers[PROFILE_ID_HEADER as never]
  const idValue = Array.isArray(rawId) ? rawId[0] : rawId
  const id = isProfileId(idValue) ? idValue.trim() : undefined

  const rawName = req.headers[PROFILE_NAME_HEADER as never]
  const nameValue = Array.isArray(rawName) ? rawName[0] : rawName
  let name = ''
  if (typeof nameValue === 'string' && nameValue) {
    try {
      name = normalizeProfileName(decodeURIComponent(nameValue))
    } catch {
      name = ''
    }
  }
  return { id, name }
}

/**
 * What the extension signs.
 *
 * The profile id is part of the signed payload, so a captured request cannot
 * be relabelled as another profile without the pairing secret. This is not a
 * cryptographic identity between profiles: every paired copy holds the same
 * secret, which is why the selection check is enforced by the app.
 */
function signingPayload(profileId: string, payload: string): string {
  return `${profileId}\n${payload}`
}

/**
 * Remembers the protocol version the extension reported.
 *
 * The manager holds it, so that the settings page can tell an extension that
 * is too old from one that is not there at all.
 */
function recordProtocolVersion(
  manager: unknown,
  req: IncomingMessage,
  profileId: string | undefined
): void {
  const version = readProtocolVersion(req.headers['x-protocol-version' as never])
  if (version === null) return
  const mgr = manager as unknown as {
    _extensionProtocolVersion?: number | null
    recordExtensionProtocolVersion?: (id: string | undefined, value: number) => void
  }
  if (typeof mgr.recordExtensionProtocolVersion === 'function') {
    mgr.recordExtensionProtocolVersion(profileId, version)
    return
  }
  mgr._extensionProtocolVersion = version
}

/**
 * Remembers that the extension is talking to the app.
 *
 * A request from the paired extension's origin is the proof that the
 * extension is alive. The old heartbeat that posted cookies every minute is
 * gone — the extension pushes only when something changed — so without this
 * the app would keep saying "the extension is not connected" to an extension
 * that is running perfectly, and the row of an outdated extension would say
 * "not connected" instead of "reload the extension".
 */
function markExtensionSeen(manager: unknown, profile: RequestProfile): void {
  const mgr = manager as unknown as {
    markExtensionSeen(profileId?: string, profileName?: string): void
  }
  mgr.markExtensionSeen(profile.id, profile.name)
}

/** Remembers that the extension knows the pairing code. */
async function markExtensionPaired(manager: unknown, profile: RequestProfile): Promise<void> {
  const mgr = manager as unknown as {
    markExtensionPaired(profileId?: string): void | Promise<void>
  }
  await mgr.markExtensionPaired(profile.id)
}

export function createBridgeRequestHandler(manager: unknown) {
  /**
   * One round per Chrome profile.
   *
   * Two profiles can ask for their site list at the same time. Each gets its
   * own round, so the packets of one profile are never accepted against the
   * target list that another profile opened.
   *
   * A round is opened once per profile even when two site-list requests
   * overlap: a second round opened while the packets of the first are still on
   * their way would replace the list they were prepared against.
   */
  const rounds = new Map<string, SiteSessionRound>()
  const roundOpenings = new Map<string, Promise<SiteSessionRound>>()

  function openRoundFor(profileId: string): Promise<SiteSessionRound> {
    const opening = roundOpenings.get(profileId)
    if (opening) return opening
    const next = openSiteSessionRound()
      .then((round) => {
        rounds.set(profileId, round)
        return round
      })
      .finally(() => {
        roundOpenings.delete(profileId)
      })
    roundOpenings.set(profileId, next)
    return next
  }

  /** The round of the packets that are on their way for this profile. */
  async function currentRound(profileId: string): Promise<SiteSessionRound> {
    const round = rounds.get(profileId)
    if (round) return round
    return openRoundFor(profileId)
  }

  return (req: IncomingMessage, res: ServerResponse): void => {
    const requestOrigin = req.headers.origin as string | undefined
    const originAllowed = isAllowedBridgeOrigin(requestOrigin, getOriginPolicy(manager))
    const profile = readRequestProfile(req)

    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      `Content-Type, x-hmac-signature, x-protocol-version, ${PROFILE_ID_HEADER}, ${PROFILE_NAME_HEADER}`
    )
    res.setHeader('Vary', 'Origin')
    if (originAllowed && requestOrigin) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    }

    if (req.method === 'OPTIONS') {
      if (!originAllowed) {
        rejectDisallowedOrigin(res, requestOrigin)
        return
      }
      res.writeHead(204)
      res.end()
      return
    }

    if (!originAllowed) {
      rejectDisallowedOrigin(res, requestOrigin)
      return
    }

    // The request passed the origin check, so the extension is alive. This
    // happens before the routing: a request that is refused further down — a
    // packet for a site that is switched off, an old extension that still
    // speaks the old protocol — still proves that the extension is there.
    markExtensionSeen(manager, profile)

    // The extension names the protocol it speaks in every request it makes to
    // the bridge. The version is remembered before the request is answered,
    // so that the settings page knows how old the extension is.
    recordProtocolVersion(manager, req, profile.id)

    if (req.method === 'GET' && req.url === '/api/health') {
      const mgr = manager as unknown as {
        _extensionLastSeenAt: number
        instanceId: string
      }
      mgr._extensionLastSeenAt = Date.now()
      Logger.info(`[NativeMessaging] Served bridge health check to origin: ${requestOrigin}`)
      // The health answer carries no secret: the user pairs the extension by
      // pasting the code from the settings page into its popup.
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          // Identifies this running bridge, so the extension can tell a restart
          // from the same bridge without seeing the secret itself.
          instanceId: mgr.instanceId,
          protocolVersion: SITE_SESSION_PROTOCOL_VERSION
        })
      )
      return
    }

    if (req.method === 'GET' && req.url === '/api/sites') {
      if (!profile.id) {
        // An extension that predates profile identities still reaches this
        // endpoint. Refusing it with 400 would make the app show "not paired"
        // forever instead of "update the extension", and would make the
        // pairing dialog fail even though the code is correct.
        void handleLegacySiteListRequest(req, res, manager)
        return
      }
      void handleSiteListRequest(req, res, manager, profile.id, async () => {
        // The site list request opens the round: the packets that follow it
        // belong to it and share its target list. Overlapping requests of the
        // same profile share the opening instead of replacing each other.
        return openRoundFor(profile.id as string)
      })
      return
    }

    if (req.method === 'POST' && req.url === '/api/cookies') {
      if (!profile.id) {
        sendJson(res, 400, { error: 'Missing profile id' })
        return
      }
      handleCookiePost(req, res, manager, profile.id, currentRound)
      return
    }

    res.writeHead(404)
    res.end('Not found')
  }
}

/**
 * The list of sites the extension may read cookies for.
 *
 * The list is signed like the cookie packets are: the paired extension reads
 * its copy of the pairing code from `chrome.storage.local`, and every request
 * proves it holds that code.
 *
 * The signature is not the boundary that keeps a local process out. A local
 * process that can read the app's user data can read the same file, and one
 * that can impersonate the extension can sign perfectly. The signature only
 * raises the bar. The secret is deliberately not served over HTTP: an HTTP
 * endpoint that returns it can be called by any local process with a forged
 * Origin header.
 *
 * The real bound is the router: a packet is written only into a site that is
 * switched on, and every cookie in it has to belong to that site.
 */
async function handleSiteListRequest(
  req: IncomingMessage,
  res: ServerResponse,
  manager: unknown,
  profileId: string,
  openRound: () => Promise<SiteSessionRound>
): Promise<void> {
  const mgr = manager as unknown as {
    _sharedSecret: string
    getSelectedProfileId?: () => string | null
    getSelectionVersion?: () => number
  }
  const signature = req.headers['x-hmac-signature' as never] as string | undefined
  if (
    !isValidSignature(
      signingPayload(profileId, SITE_LIST_SIGNING_PAYLOAD),
      signature,
      mgr._sharedSecret
    )
  ) {
    Logger.warn('[NativeMessaging] Rejected site list request: invalid signature')
    sendJson(res, 401, { error: 'Invalid signature' })
    return
  }
  await markExtensionPaired(manager, { id: profileId, name: '' })

  void openRound()
    .then((round) => listEnabledSiteSessionTargets(round))
    .then((list) => {
      // Every profile asks for the same list. The selection tells each one
      // whether it is the source the user picked; only that profile pushes.
      sendJson(res, 200, {
        ...list,
        selectedProfileId: mgr.getSelectedProfileId?.() ?? null,
        selectionVersion: mgr.getSelectionVersion?.() ?? 0
      })
    })
    .catch((error: unknown) => {
      Logger.error('[NativeMessaging] Failed to list the site session targets:', error)
      sendJson(res, 500, { error: 'Internal error' })
    })
}

/**
 * Answers an extension that predates profile ids.
 *
 * The signature is the old one (the path alone), and the answer deliberately
 * says protocol 1: an old extension reads that as "the app is too old for me"
 * and stops pushing instead of filling the bridge with packets that cannot
 * carry a profile id. The app has already recorded the version the extension
 * reported, so the settings row says "update the extension".
 */
async function handleLegacySiteListRequest(
  req: IncomingMessage,
  res: ServerResponse,
  manager: unknown
): Promise<void> {
  const mgr = manager as unknown as { _sharedSecret: string }
  const signature = req.headers['x-hmac-signature' as never] as string | undefined
  if (!isValidSignature(SITE_LIST_SIGNING_PAYLOAD, signature, mgr._sharedSecret)) {
    Logger.warn('[NativeMessaging] Rejected legacy site list request: invalid signature')
    sendJson(res, 401, { error: 'Invalid signature' })
    return
  }
  await markExtensionPaired(manager, { id: undefined, name: '' })

  void openSiteSessionRound()
    .then((round) => listEnabledSiteSessionTargets(round))
    .then((list) => {
      sendJson(res, 200, {
        ...list,
        protocolVersion: 1,
        selectedProfileId: null,
        selectionVersion: 0
      })
    })
    .catch((error: unknown) => {
      Logger.error('[NativeMessaging] Failed to list the targets for a legacy extension:', error)
      sendJson(res, 500, { error: 'Internal error' })
    })
}

/** Whether a signature matches the payload it is supposed to cover. */
function isValidSignature(payload: string, signature: string | undefined, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return matchesSignature(expected, signature)
}

/**
 * Whether a signature matches a digest that was computed over a body.
 *
 * The digest is computed while the body comes in, so a body that does not fit
 * into the bridge can be signed as well — the signature covers the whole body,
 * not only the part that was kept.
 */
function matchesSignature(expected: string, signature: string | undefined): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false
  return crypto.timingSafeEqual(
    Buffer.from(expected.toLowerCase()),
    Buffer.from(signature.toLowerCase())
  )
}

/**
 * The site a packet belongs to, read out of a body that is too large to parse.
 *
 * The site id is the first field of a packet, so it can be read out of the
 * beginning of the body even when the rest of it does not fit into the bridge.
 */
function readTargetId(body: string): string | null {
  const match = /"targetId"\s*:\s*"([^"]*)"/.exec(body)
  return match ? match[1] : null
}

function handleCookiePost(
  req: IncomingMessage,
  res: ServerResponse,
  manager: unknown,
  profileId: string,
  currentRound: (profileId: string) => Promise<SiteSessionRound>
): void {
  const mgr = manager as unknown as {
    _sharedSecret: string
    getSelectedProfileId?: () => string | null
    isSelectionChanging?: () => boolean
  }
  const signature = req.headers['x-hmac-signature' as never] as string | undefined
  if (!signature) {
    Logger.warn('[NativeMessaging] Rejected cookie POST: missing HMAC signature')
    sendJson(res, 401, { error: 'Missing signature' })
    return
  }

  let bodySize = 0
  let oversized = false
  const chunks: Buffer[] = []
  // The signature covers the profile id and the whole body, so it is hashed
  // while the body comes in: a body that does not fit is never kept in memory
  // as a whole, and it is still signed.
  const digest = crypto.createHmac('sha256', mgr._sharedSecret)
  digest.update(`${profileId}\n`)

  req.on('data', (chunk: Buffer) => {
    const remaining = Math.max(0, MAX_COOKIE_BODY_SIZE - bodySize)
    bodySize += chunk.length
    digest.update(chunk)
    if (remaining > 0) chunks.push(chunk.subarray(0, remaining))
    if (bodySize > MAX_COOKIE_BODY_SIZE) oversized = true
  })

  req.on('end', async () => {
    try {
      if (!matchesSignature(digest.digest('hex'), signature)) {
        Logger.warn('[NativeMessaging] Rejected cookie POST: invalid HMAC signature')
        sendJson(res, 401, { error: 'Invalid signature' })
        return
      }
      await markExtensionPaired(manager, { id: profileId, name: '' })

      // Another profile may still have packets in flight when the user
      // switches the source. They carry a valid signature, but they are no
      // longer the session the user asked for.
      const selectedProfileId = mgr.getSelectedProfileId?.() ?? null
      if (!selectedProfileId) {
        // No source has been committed. The first pairing writes it, and that
        // write may have failed; without it the app cannot tell this packet
        // from one of another Chrome profile. Refusing is the only safe answer:
        // the next request retries the selection write.
        Logger.warn('[NativeMessaging] Refused a packet while no profile is selected')
        sendJson(res, 409, { error: 'selection_unavailable', retryable: true })
        return
      }
      if (selectedProfileId !== profileId) {
        Logger.warn('[NativeMessaging] Refused a packet from a profile that is not selected')
        sendJson(res, 403, { error: 'not_selected', retryable: false })
        return
      }
      if (mgr.isSelectionChanging?.()) {
        // The app is wiping the previous source's sessions. Accepting a packet
        // now would race the wipe, so the extension retries on its next poll.
        sendJson(res, 409, { error: 'selection_changing', retryable: true })
        return
      }

      if (oversized) {
        // The packet is bigger than the bridge reads, so it can never be
        // imported. The extension is told so instead of seeing a broken
        // connection: a broken connection looks like a network that is down,
        // and the extension would push the same packet again and again.
        Logger.warn('[NativeMessaging] Rejected an oversized cookie payload')
        const siteId = readTargetId(Buffer.concat(chunks).toString('utf8'))
        if (siteId) {
          await recordOversizedSiteSessionPacket(siteId)
        }
        sendJson(res, STATUS_PACKET_TOO_LARGE, { error: PACKET_TOO_LARGE })
        return
      }

      const body = Buffer.concat(chunks).toString('utf8')
      const packet = parseSiteSessionPacket(body)
      if (!packet) {
        Logger.warn('[NativeMessaging] Rejected cookie POST: malformed packet')
        sendJson(res, 400, { error: 'Malformed packet' })
        return
      }

      const outcome = await (await currentRound(profileId)).accept(packet)
      if (!outcome.accepted) {
        Logger.warn(`[NativeMessaging] Refused a cookie packet: ${outcome.reason}`)
        // A round the app has already replaced and a wipe that is running are
        // both reasons to ask again; the others are final answers about the
        // packet or the site and must not be retried as they are.
        const retryable = outcome.reason === 'stale_round'
        sendJson(res, outcome.reason === 'domain_mismatch' ? 400 : retryable ? 409 : 403, {
          error: outcome.reason,
          retryable
        })
        return
      }

      // `accepted` and `success` answer different questions: the packet passed
      // the routing checks versus the session was really written. The old
      // field is kept for the extension, but it now tells the truth about the
      // import instead of about the envelope.
      const importSucceeded = outcome.importSucceeded ?? true
      sendJson(res, 200, {
        success: importSucceeded,
        accepted: true,
        importSucceeded,
        rolledBack: outcome.rolledBack === true,
        rollbackFailed: outcome.rollbackFailed === true,
        retryable: outcome.retryable === true,
        imported: outcome.imported ?? 0,
        failed: outcome.failed ?? 0,
        ...(outcome.staleCookiesKept !== undefined
          ? { staleCookiesKept: outcome.staleCookiesKept }
          : {})
      })
    } catch (error) {
      Logger.error('[NativeMessaging] Failed to handle the cookie packet:', error)
      sendJson(res, 500, { error: 'Internal error' })
    }
  })
}

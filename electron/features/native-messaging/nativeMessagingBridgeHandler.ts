import crypto from 'crypto'
import { app } from 'electron'
import type { IncomingMessage, ServerResponse } from 'http'

import { DEV_SERVER_ORIGIN } from '../../app/window/environment.js'
import { Logger } from '../../core/logger.js'
import {
  listEnabledSiteSessionTargets,
  openSiteSessionRound,
  parseSiteSessionPacket,
  SITE_SESSION_PROTOCOL_VERSION,
  type SiteSessionRound
} from '../web-session/siteSessionBridge.js'
import type { BridgeOriginPolicy } from './nativeMessagingOrigin.js'
import { isAllowedBridgeOrigin } from './nativeMessagingOrigin.js'
import { MAX_COOKIE_BODY_SIZE } from './nativeMessagingTypes.js'

/** The payload the extension signs when it asks for the site list. */
const SITE_LIST_SIGNING_PAYLOAD = '/api/sites'

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

/**
 * Remembers the protocol version the extension reported.
 *
 * The manager holds it, so that the settings page can tell an extension that
 * is too old from one that is not there at all.
 */
function recordProtocolVersion(manager: unknown, req: IncomingMessage): void {
  const version = readProtocolVersion(req.headers['x-protocol-version' as never])
  if (version === null) return
  const mgr = manager as unknown as { _extensionProtocolVersion: number | null }
  mgr._extensionProtocolVersion = version
}

/**
 * Remembers that the extension is talking to the app.
 *
 * A request from the paired extension's origin is the proof that the
 * extension is alive. The old heartbeat that posted cookies every minute is
 * gone — the extension pushes only when something changed — so without this
 * the app would keep saying "the extension is not installed" to an extension
 * that is running perfectly, and the row of an outdated extension would say
 * "not installed" instead of "reload the extension".
 */
function markExtensionSeen(manager: unknown): void {
  const mgr = manager as unknown as { markExtensionSeen(): void }
  mgr.markExtensionSeen()
}

export function createBridgeRequestHandler(manager: unknown) {
  /**
   * The round of the extension.
   *
   * The extension asks which sites it should push and then sends one packet
   * per site: the sites of that round do not change while it pushes them, so
   * the round holds the target list and every packet of the round shares it.
   */
  let round: SiteSessionRound | null = null

  /** The round of the packets that are on their way. */
  async function currentRound(): Promise<SiteSessionRound> {
    round ??= await openSiteSessionRound()
    return round
  }

  return (req: IncomingMessage, res: ServerResponse): void => {
    const requestOrigin = req.headers.origin as string | undefined
    const originAllowed = isAllowedBridgeOrigin(requestOrigin, getOriginPolicy(manager))

    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, x-hmac-signature, x-bridge-secret, x-protocol-version'
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
    markExtensionSeen(manager)

    // The extension names the protocol it speaks in every request it makes to
    // the bridge. The version is remembered before the request is answered,
    // so that the settings page knows how old the extension is.
    recordProtocolVersion(manager, req)

    if (req.method === 'GET' && req.url === '/api/health') {
      const mgr = manager as unknown as {
        _extensionLastSeenAt: number
        _sharedSecret: string
      }
      mgr._extensionLastSeenAt = Date.now()
      Logger.info(`[NativeMessaging] Served bridge shared secret to origin: ${requestOrigin}`)
      const healthResponse: Record<string, unknown> = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        secret: mgr._sharedSecret,
        protocolVersion: SITE_SESSION_PROTOCOL_VERSION
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(healthResponse))
      return
    }

    if (req.method === 'GET' && req.url === '/api/sites') {
      handleSiteListRequest(req, res, manager, async () => {
        // The site list request opens the round: the packets that follow it
        // belong to it and share its target list.
        round = await openSiteSessionRound()
        return round
      })
      return
    }

    if (req.method === 'POST' && req.url === '/api/cookies') {
      handleCookiePost(req, res, manager, currentRound)
      return
    }

    res.writeHead(404)
    res.end('Not found')
  }
}

/**
 * The list of sites the extension may read cookies for.
 *
 * The list is signed like the cookie packets are: the health endpoint hands
 * the secret to the paired extension, and every later request proves it holds
 * that secret.
 *
 * The signature is not the boundary that keeps a local process out. The
 * health endpoint hands the secret to any request that carries the expected
 * `Origin` header, and a local process can forge that header and sign
 * perfectly. The signature only raises the bar.
 *
 * The real bound is the router: a packet is written only into a site that is
 * switched on, and every cookie in it has to belong to that site.
 */
function handleSiteListRequest(
  req: IncomingMessage,
  res: ServerResponse,
  manager: unknown,
  openRound: () => Promise<SiteSessionRound>
): void {
  const mgr = manager as unknown as { _sharedSecret: string }
  const signature = req.headers['x-hmac-signature' as never] as string | undefined
  if (!isValidSignature(SITE_LIST_SIGNING_PAYLOAD, signature, mgr._sharedSecret)) {
    Logger.warn('[NativeMessaging] Rejected site list request: invalid signature')
    sendJson(res, 401, { error: 'Invalid signature' })
    return
  }

  void openRound()
    .then((round) => listEnabledSiteSessionTargets(round))
    .then((list) => {
      sendJson(res, 200, list)
    })
    .catch((error: unknown) => {
      Logger.error('[NativeMessaging] Failed to list the site session targets:', error)
      sendJson(res, 500, { error: 'Internal error' })
    })
}

/** Whether a signature matches the payload it is supposed to cover. */
function isValidSignature(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature.toLowerCase()), Buffer.from(expected))
}

function handleCookiePost(
  req: IncomingMessage,
  res: ServerResponse,
  manager: unknown,
  currentRound: () => Promise<SiteSessionRound>
): void {
  const mgr = manager as unknown as {
    _sharedSecret: string
  }
  const signature = req.headers['x-hmac-signature' as never] as string | undefined
  if (!signature) {
    Logger.warn('[NativeMessaging] Rejected cookie POST: missing HMAC signature')
    sendJson(res, 401, { error: 'Missing signature' })
    return
  }

  let body = ''
  let bodySize = 0

  req.on('data', (chunk: Buffer) => {
    bodySize += chunk.length
    if (bodySize > MAX_COOKIE_BODY_SIZE) {
      req.destroy()
      Logger.warn('[NativeMessaging] Rejected oversized cookie payload')
      return
    }
    body += chunk.toString()
  })

  req.on('end', async () => {
    try {
      if (!isValidSignature(body, signature, mgr._sharedSecret)) {
        Logger.warn('[NativeMessaging] Rejected cookie POST: invalid HMAC signature')
        sendJson(res, 401, { error: 'Invalid signature' })
        return
      }

      const packet = parseSiteSessionPacket(body)
      if (!packet) {
        Logger.warn('[NativeMessaging] Rejected cookie POST: malformed packet')
        sendJson(res, 400, { error: 'Malformed packet' })
        return
      }

      const outcome = await (await currentRound()).accept(packet)
      if (!outcome.accepted) {
        Logger.warn(`[NativeMessaging] Refused a cookie packet: ${outcome.reason}`)
        sendJson(res, outcome.reason === 'domain_mismatch' ? 400 : 403, {
          error: outcome.reason
        })
        return
      }

      sendJson(res, 200, { success: true, imported: outcome.imported ?? 0 })
    } catch (error) {
      Logger.error('[NativeMessaging] Failed to handle the cookie packet:', error)
      sendJson(res, 500, { error: 'Internal error' })
    }
  })
}

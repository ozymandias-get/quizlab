import crypto from 'crypto'
import { app } from 'electron'
import type { IncomingMessage, ServerResponse } from 'http'

import { DEV_SERVER_ORIGIN } from '../../app/window/environment.js'
import { Logger } from '../../core/logger.js'
import {
  acceptSiteSessionPacket,
  listEnabledSiteSessionTargets,
  parseSiteSessionPacket,
  SITE_SESSION_PROTOCOL_VERSION
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

export function createBridgeRequestHandler(manager: unknown) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const requestOrigin = req.headers.origin as string | undefined
    const originAllowed = isAllowedBridgeOrigin(requestOrigin, getOriginPolicy(manager))

    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hmac-signature, x-bridge-secret')
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
      handleSiteListRequest(req, res, manager)
      return
    }

    if (req.method === 'POST' && req.url === '/api/cookies') {
      handleCookiePost(req, res, manager)
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
 * that secret. A local process that forges the origin header therefore still
 * gets nothing it could use.
 */
function handleSiteListRequest(req: IncomingMessage, res: ServerResponse, manager: unknown): void {
  const mgr = manager as unknown as { _sharedSecret: string }
  const signature = req.headers['x-hmac-signature' as never] as string | undefined
  if (!isValidSignature(SITE_LIST_SIGNING_PAYLOAD, signature, mgr._sharedSecret)) {
    Logger.warn('[NativeMessaging] Rejected site list request: invalid signature')
    sendJson(res, 401, { error: 'Invalid signature' })
    return
  }

  void listEnabledSiteSessionTargets()
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

function handleCookiePost(req: IncomingMessage, res: ServerResponse, manager: unknown): void {
  const mgr = manager as unknown as {
    _sharedSecret: string
    _connectionStatus: string
    _waitingSince: number | null
    _extensionLastSeenAt: number
    broadcastExtensionConnected(): void
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

      if (mgr._connectionStatus !== 'connected') {
        mgr._connectionStatus = 'connected'
        mgr._waitingSince = null
        mgr._extensionLastSeenAt = Date.now()
        mgr.broadcastExtensionConnected()
      }
      mgr._extensionLastSeenAt = Date.now()

      const outcome = await acceptSiteSessionPacket(packet)
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

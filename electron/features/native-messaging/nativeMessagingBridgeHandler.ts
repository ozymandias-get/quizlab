import type { ChromeExtensionCookie } from '@shared-core/types'

import crypto from 'crypto'
import { session as electronSession } from 'electron'
import { app } from 'electron'
import type { IncomingMessage, ServerResponse } from 'http'

import { DEV_SERVER_ORIGIN } from '../../app/window/environment.js'
import { Logger } from '../../core/logger.js'
import { PROFILE_PARTITION } from '../gemini-web-session/sessionConfig.js'
import { importExternalCookies } from '../gemini-web-session/sessionCookies.js'
import { toExternalBrowserCookie } from './nativeMessagingCookieUtils.js'
import type { BridgeOriginPolicy } from './nativeMessagingOrigin.js'
import { isAllowedBridgeOrigin, validateCookieDomains } from './nativeMessagingOrigin.js'
import { MAX_COOKIE_BODY_SIZE } from './nativeMessagingTypes.js'

type NativeMessagingManagerLike = {
  _expectedExtensionOrigin: string | null
  _sharedSecret: string
  _connectionStatus: string
  _waitingSince: number | null
  _extensionLastSeenAt: number
  broadcastExtensionConnected(): void
}

export function getOriginPolicy(manager: NativeMessagingManagerLike): BridgeOriginPolicy {
  const isDev = !app.isPackaged
  return {
    expectedExtensionOrigin: (manager as unknown as { _expectedExtensionOrigin: string | null })
      ._expectedExtensionOrigin,
    allowedDevOrigins: isDev && DEV_SERVER_ORIGIN ? [DEV_SERVER_ORIGIN] : [],
    isDev
  }
}

export function rejectDisallowedOrigin(res: ServerResponse, origin: string | undefined): void {
  Logger.warn(`[NativeMessaging] Rejected request from disallowed origin: ${origin || '(none)'}`)
  res.writeHead(403, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Forbidden' }))
}

export function createBridgeRequestHandler(manager: NativeMessagingManagerLike) {
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
        secret: mgr._sharedSecret
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(healthResponse))
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

function handleCookiePost(
  req: IncomingMessage,
  res: ServerResponse,
  manager: NativeMessagingManagerLike
): void {
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
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Missing signature' }))
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
      const expectedSig = crypto.createHmac('sha256', mgr._sharedSecret).update(body).digest('hex')
      if (
        !/^[0-9a-f]{64}$/i.test(signature) ||
        !crypto.timingSafeEqual(Buffer.from(signature.toLowerCase()), Buffer.from(expectedSig))
      ) {
        Logger.warn('[NativeMessaging] Rejected cookie POST: invalid HMAC signature')
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid signature' }))
        return
      }

      const data = JSON.parse(body)
      const cookies = data.cookies as ChromeExtensionCookie[]

      if (!Array.isArray(cookies) || cookies.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'No cookies provided' }))
        return
      }

      if (!validateCookieDomains(cookies)) {
        Logger.warn('[NativeMessaging] Rejected cookie POST: invalid domain')
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid cookie domain' }))
        return
      }

      if (mgr._connectionStatus !== 'connected') {
        mgr._connectionStatus = 'connected'
        mgr._waitingSince = null
        mgr._extensionLastSeenAt = Date.now()
        mgr.broadcastExtensionConnected()
      }

      mgr._extensionLastSeenAt = Date.now()

      const externalCookies = cookies.map(toExternalBrowserCookie)
      const targetSession = electronSession.fromPartition(PROFILE_PARTITION)
      await importExternalCookies(targetSession, externalCookies)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, imported: cookies.length }))
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal error' }))
    }
  })
}

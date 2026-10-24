import { createHmac } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SECRET = 'bridge-secret-for-the-test'
const EXTENSION_ORIGIN = 'chrome-extension://quizlab-test-extension'
const SITE_LIST_PATH = '/api/sites'
const COOKIE_PATH = '/api/cookies'

const recordOversizedSiteSessionPacket = vi.hoisted(() => vi.fn(async () => {}))
const acceptPacket = vi.hoisted(() => vi.fn(async () => ({ accepted: true, imported: 1 })))

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/tmp/quizlab-userdata') },
  BrowserWindow: { getAllWindows: vi.fn(() => []) }
}))

vi.mock('../../../features/web-session/siteSessionBridge.js', () => ({
  SITE_SESSION_PROTOCOL_VERSION: 2,
  PACKET_TOO_LARGE: 'packet_too_large',
  listEnabledSiteSessionTargets: vi.fn(async () => ({
    protocolVersion: 2,
    configVersion: 1,
    targets: []
  })),
  openSiteSessionRound: vi.fn(async () => ({ targets: [], accept: acceptPacket })),
  parseSiteSessionPacket: vi.fn((body: string) => JSON.parse(body) as unknown),
  recordOversizedSiteSessionPacket
}))

import { createBridgeRequestHandler } from '../../../features/native-messaging/nativeMessagingBridgeHandler.js'
import { MAX_COOKIE_BODY_SIZE } from '../../../features/native-messaging/nativeMessagingTypes.js'

/** The manager the bridge talks to. */
function createManager() {
  return {
    _sharedSecret: SECRET,
    _extensionLastSeenAt: 0,
    _extensionProtocolVersion: null,
    _expectedExtensionOrigin: EXTENSION_ORIGIN,
    markExtensionSeen: vi.fn()
  }
}

/** The signature the app expects for a body. */
function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body).digest('hex')
}

describe('the bridge of the site session', () => {
  let server: http.Server
  let port: number

  beforeEach(async () => {
    recordOversizedSiteSessionPacket.mockClear()
    acceptPacket.mockClear()
    server = http.createServer(createBridgeRequestHandler(createManager()))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  /** Posts a body to the bridge the way the extension does. */
  async function post(body: string, signature?: string): Promise<Response> {
    return fetch(`http://127.0.0.1:${port}${COOKIE_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: EXTENSION_ORIGIN,
        'x-hmac-signature': signature ?? sign(body)
      },
      body,
      // A request that is answered with a broken connection never ends: the
      // test fails fast instead of waiting for the timeout of the runner.
      signal: AbortSignal.timeout(2000)
    })
  }

  /** A packet whose body does not fit into the bridge. */
  function oversizedBody(): string {
    return JSON.stringify({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [
        { name: 'session', value: 'x'.repeat(MAX_COOKIE_BODY_SIZE), domain: '.chatgpt.com' }
      ]
    })
  }

  it('answers a packet that does not fit with 413 and not with a broken connection', async () => {
    const body = oversizedBody()
    expect(body.length).toBeGreaterThan(MAX_COOKIE_BODY_SIZE)

    const response = await post(body)

    // The extension has to be able to tell "too large" from "the network is
    // down": a broken connection looks like a network that is down.
    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({ error: 'packet_too_large' })
  })

  it('records the site of a packet that does not fit as a failed import', async () => {
    await post(oversizedBody())

    expect(recordOversizedSiteSessionPacket).toHaveBeenCalledWith('chatgpt')
  })

  it('imports nothing when a packet does not fit', async () => {
    await post(oversizedBody())

    expect(acceptPacket).not.toHaveBeenCalled()
  })

  it('does not record a site for a packet that is not signed', async () => {
    const response = await post(oversizedBody(), 'a'.repeat(64))

    expect(response.status).toBe(401)
    expect(recordOversizedSiteSessionPacket).not.toHaveBeenCalled()
  })

  it('still imports a packet that fits', async () => {
    const body = JSON.stringify({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
    })

    const response = await post(body)

    expect(response.status).toBe(200)
    expect(acceptPacket).toHaveBeenCalledTimes(1)
    expect(recordOversizedSiteSessionPacket).not.toHaveBeenCalled()
  })

  it('answers the health check of the extension', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: { Origin: EXTENSION_ORIGIN }
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ secret: SECRET })
  })

  it('answers the signed site list request', async () => {
    const response = await fetch(`http://127.0.0.1:${port}${SITE_LIST_PATH}`, {
      headers: { Origin: EXTENSION_ORIGIN, 'x-hmac-signature': sign(SITE_LIST_PATH) }
    })

    expect(response.status).toBe(200)
  })
})

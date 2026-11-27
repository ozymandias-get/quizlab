import crypto, { createHmac, type BinaryLike, type BinaryToTextEncoding } from 'node:crypto'
import { EventEmitter } from 'node:events'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SECRET = 'bridge-secret-for-the-test'
const EXTENSION_ORIGIN = 'chrome-extension://quizlab-test-extension'
const PROFILE_ID = 'test-profile-1234'
const PROFILE_NAME = 'Test%20Chrome'
const SITE_LIST_PATH = '/api/sites'
const COOKIE_PATH = '/api/cookies'

const recordOversizedSiteSessionPacket = vi.hoisted(() => vi.fn(async () => {}))
const acceptPacket = vi.hoisted(() =>
  vi.fn(async (): Promise<Record<string, unknown>> => ({ accepted: true, imported: 1 }))
)
const handleSelectorBridgeRequest = vi.hoisted(() =>
  vi.fn((_request?: unknown, _response?: unknown) => false)
)

vi.mock('../../../features/native-messaging/selectorBridge.js', () => ({
  handleSelectorBridgeRequest
}))

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/tmp/quizlab-userdata') },
  BrowserWindow: { getAllWindows: vi.fn(() => []) }
}))

vi.mock('../../../features/web-session/siteSessionBridge.js', () => ({
  SITE_SESSION_PROTOCOL_VERSION: 3,
  PACKET_TOO_LARGE: 'packet_too_large',
  listEnabledSiteSessionTargets: vi.fn(async () => ({
    protocolVersion: 3,
    configVersion: 1,
    targets: []
  })),
  openSiteSessionRound: vi.fn(async () => ({ targets: [], accept: acceptPacket })),
  parseSiteSessionPacket: vi.fn((body: string) => JSON.parse(body) as unknown),
  recordOversizedSiteSessionPacket
}))

import { createBridgeRequestHandler } from '../../../features/native-messaging/nativeMessagingBridgeHandler.js'
import {
  MAX_COOKIE_BODY_SIZE,
  MAX_COOKIE_READ_SIZE
} from '../../../features/native-messaging/nativeMessagingTypes.js'
import { openSiteSessionRound } from '../../../features/web-session/siteSessionBridge.js'

/** The manager the bridge talks to. */
function createManager() {
  return {
    _sharedSecret: SECRET,
    _extensionLastSeenAt: 0,
    _extensionProtocolVersion: null,
    _expectedExtensionOrigin: EXTENSION_ORIGIN,
    instanceId: 'test-bridge',
    getSelectedProfileId: (): string | null => PROFILE_ID,
    getSelectionVersion: () => 4,
    isSelectionChanging: () => false,
    markExtensionReachable: vi.fn(),
    markExtensionSeen: vi.fn(),
    markExtensionPaired: vi.fn()
  }
}

/** The signature the app expects for a body. */
function sign(body: string): string {
  return createHmac('sha256', SECRET).update(`${PROFILE_ID}\n${body}`).digest('hex')
}

/** The headers every request of the extension carries for its profile. */
function profileHeaders(): Record<string, string> {
  return {
    Origin: EXTENSION_ORIGIN,
    'x-quizlab-profile-id': PROFILE_ID,
    'x-quizlab-profile-name': PROFILE_NAME
  }
}

/** A cookie packet whose single cookie value is as long as asked. */
function packetBody(valueLength: number): string {
  return JSON.stringify({
    targetId: 'chatgpt',
    status: 'ok',
    cookies: [{ name: 'session', value: 'x'.repeat(valueLength), domain: '.chatgpt.com' }]
  })
}

/** A request as the HTTP server hands it to the handler. */
function createRequestDouble(signature: string) {
  return Object.assign(new EventEmitter(), {
    method: 'POST',
    url: COOKIE_PATH,
    headers: {
      origin: EXTENSION_ORIGIN,
      'x-quizlab-profile-id': PROFILE_ID,
      'x-quizlab-profile-name': PROFILE_NAME,
      'x-hmac-signature': signature
    } as Record<string, string>,
    socket: { end: vi.fn() }
  })
}

/** A response the handler writes to. */
function createResponseDouble() {
  return Object.assign(new EventEmitter(), {
    setHeader: vi.fn(),
    writeHead: vi.fn(),
    end: vi.fn((chunkOrCallback?: unknown, callback?: () => void) => {
      if (typeof chunkOrCallback === 'function') chunkOrCallback()
      else callback?.()
    })
  })
}

describe('the bridge of the site session', () => {
  let server: http.Server
  let port: number
  let manager: ReturnType<typeof createManager>

  beforeEach(async () => {
    recordOversizedSiteSessionPacket.mockClear()
    acceptPacket.mockClear()
    handleSelectorBridgeRequest.mockClear()
    vi.mocked(openSiteSessionRound).mockClear()
    manager = createManager()
    server = http.createServer(createBridgeRequestHandler(manager))
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
        ...profileHeaders(),
        'x-hmac-signature': signature ?? sign(body)
      },
      body,
      // A request that is answered with a broken connection never ends: the
      // test fails fast instead of waiting for the timeout of the runner.
      signal: AbortSignal.timeout(2000)
    })
  }

  /** Posts a body as another profile, signed with that profile's id. */
  async function postAs(profileId: string, body: string): Promise<Response> {
    const signature = createHmac('sha256', SECRET).update(`${profileId}\n${body}`).digest('hex')
    return fetch(`http://127.0.0.1:${port}${COOKIE_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: EXTENSION_ORIGIN,
        'x-quizlab-profile-id': profileId,
        'x-quizlab-profile-name': PROFILE_NAME,
        'x-hmac-signature': signature
      },
      body,
      signal: AbortSignal.timeout(2000)
    })
  }

  /** A packet whose body does not fit into the bridge. */
  function oversizedBody(): string {
    return packetBody(MAX_COOKIE_BODY_SIZE)
  }

  /**
   * What one raw upload saw.
   *
   * `bytesWrittenAtResponse` is how much of the body the client had handed to
   * the socket when the answer arrived: it is the observable difference
   * between "the bridge reads the whole upload" and "the bridge stops at its
   * own limit".
   */
  function upload(
    body: string,
    options: { chunkSize?: number; delayMs?: number } = {}
  ): Promise<{
    status: number
    text: string
    bytesWrittenAtResponse: number
    bytesSent: number
  }> {
    const payload = Buffer.from(body)
    const chunkSize = options.chunkSize ?? 64 * 1024
    const delayMs = options.delayMs ?? 0

    return new Promise((resolve, reject) => {
      let written = 0
      let responded = false
      let settled = false
      let status = 0
      let bytesWrittenAtResponse = -1
      let text = ''

      const finish = (): void => {
        if (settled) return
        settled = true
        resolve({ status, text, bytesWrittenAtResponse, bytesSent: written })
      }

      const request = http.request({
        host: '127.0.0.1',
        port,
        path: COOKIE_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...profileHeaders(),
          'Content-Length': payload.byteLength,
          'x-hmac-signature': sign(body)
        }
      })
      request.setTimeout(5000, () => request.destroy(new Error('upload timeout')))

      request.on('response', (response) => {
        responded = true
        status = response.statusCode ?? 0
        bytesWrittenAtResponse = written
        response.setEncoding('utf8')
        response.on('data', (chunk: string) => {
          text += chunk
        })
        response.on('end', finish)
        response.on('close', finish)
      })
      request.on('error', (error: Error) => {
        // An answer that arrived before the connection broke is still the
        // answer: the client read it out of its own buffer.
        if (responded) finish()
        else reject(error)
      })

      const pump = (): void => {
        if (settled) {
          request.destroy()
          return
        }
        while (written < payload.byteLength) {
          const chunk = payload.subarray(written, Math.min(written + chunkSize, payload.byteLength))
          written += chunk.byteLength
          if (!request.write(chunk)) {
            request.once('drain', pump)
            return
          }
          if (delayMs > 0) {
            setTimeout(pump, delayMs)
            return
          }
        }
        request.end()
      }
      pump()
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

  it('retains the packet prefix when a single chunk exceeds the size limit', async () => {
    const body = oversizedBody()
    const request = createRequestDouble(sign(body))
    const response = createResponseDouble()
    createBridgeRequestHandler(createManager())(request as never, response as never)
    request.emit('data', Buffer.from(body))
    request.emit('end')
    await vi.waitFor(() => expect(response.end).toHaveBeenCalled())
    expect(recordOversizedSiteSessionPacket).toHaveBeenCalledWith('chatgpt')
    expect(response.writeHead).toHaveBeenCalledWith(413, expect.anything())
  })

  it('imports nothing when a packet does not fit', async () => {
    await post(oversizedBody())

    expect(acceptPacket).not.toHaveBeenCalled()
  })

  it('imports a packet that is just under the size limit', async () => {
    const body = packetBody(MAX_COOKIE_BODY_SIZE - 4096)
    expect(Buffer.byteLength(body)).toBeLessThan(MAX_COOKIE_BODY_SIZE)

    const response = await post(body)

    expect(response.status).toBe(200)
    expect(acceptPacket).toHaveBeenCalledTimes(1)
    expect(recordOversizedSiteSessionPacket).not.toHaveBeenCalled()
  })

  it('stops reading and hashing a body that is past the read limit', async () => {
    // Sixteen times the most the bridge ever reads.
    const body = packetBody(8 * 1024 * 1024)
    const hashed: number[] = []
    const realCreateHmac = crypto.createHmac
    const hmacSpy = vi.spyOn(crypto, 'createHmac').mockImplementation(((
      algorithm: string,
      key: BinaryLike
    ) => {
      const hmac = realCreateHmac(algorithm, key)
      const realUpdate = hmac.update.bind(hmac)
      hmac.update = ((data: BinaryLike, encoding?: BinaryToTextEncoding) => {
        hashed.push(
          typeof data === 'string' ? Buffer.byteLength(data) : (data as Uint8Array).byteLength
        )
        return realUpdate(data as never, encoding as never)
      }) as typeof hmac.update
      return hmac
    }) as typeof crypto.createHmac)

    try {
      const result = await upload(body)

      expect(result.status).toBe(413)
      expect(JSON.parse(result.text)).toEqual({ error: 'packet_too_large' })
      // The answer arrives before the whole body is uploaded.
      expect(result.bytesWrittenAtResponse).toBeLessThan(Buffer.byteLength(body))

      // Only the bytes the bridge reads are signed. The rest is never hashed,
      // so an upload that never ends cannot burn CPU.
      const hashedBytes = hashed.reduce((total, value) => total + value, 0)
      expect(hashedBytes).toBeGreaterThan(0)
      expect(hashedBytes).toBeLessThanOrEqual(MAX_COOKIE_READ_SIZE + 64)
      // The signature of an unread body cannot be checked, so no site is
      // recorded as a failed import for it.
      expect(recordOversizedSiteSessionPacket).not.toHaveBeenCalled()
    } finally {
      hmacSpy.mockRestore()
    }
  })

  it('answers a body of huge chunks once and closes the socket after it', async () => {
    const request = createRequestDouble('a'.repeat(64))
    const response = createResponseDouble()
    createBridgeRequestHandler(createManager())(request as never, response as never)

    request.emit('data', Buffer.alloc(2 * 1024 * 1024, 0x20))

    // The body is past every byte the bridge reads: the answer does not wait
    // for the rest of the upload.
    expect(response.writeHead).toHaveBeenCalledTimes(1)
    expect(response.writeHead).toHaveBeenCalledWith(413, expect.anything())
    expect(response.end).toHaveBeenCalledTimes(1)
    // The socket is ended gracefully, so the client reads the answer instead of
    // a reset that would look like a network failure and trigger a retry.
    expect(request.socket.end).toHaveBeenCalledTimes(1)

    // The rest of the upload neither answers a second time nor is imported.
    request.emit('data', Buffer.alloc(2 * 1024 * 1024, 0x20))
    request.emit('end')
    await Promise.resolve()

    expect(response.writeHead).toHaveBeenCalledTimes(1)
    expect(response.end).toHaveBeenCalledTimes(1)
    expect(recordOversizedSiteSessionPacket).not.toHaveBeenCalled()
    expect(acceptPacket).not.toHaveBeenCalled()
  })

  it('answers a slow upload that crosses the read limit without waiting for its end', async () => {
    const body = packetBody(2 * 1024 * 1024)

    const result = await upload(body, { chunkSize: 32 * 1024, delayMs: 4 })

    expect(result.status).toBe(413)
    expect(JSON.parse(result.text)).toEqual({ error: 'packet_too_large' })
    // A slow uploader must not keep the bridge reading until it decides to
    // stop: the answer comes when the bridge has read its own limit.
    expect(result.bytesWrittenAtResponse).toBeLessThan(Buffer.byteLength(body))
  })

  it('survives a client that hangs up in the middle of a body', async () => {
    const request = createRequestDouble('a'.repeat(64))
    const response = createResponseDouble()
    createBridgeRequestHandler(createManager())(request as never, response as never)

    request.emit('data', Buffer.from(packetBody(64)))
    // An unhandled `error` on the request would become an uncaught exception.
    expect(() => request.emit('error', new Error('read ECONNRESET'))).not.toThrow()
    request.emit('end')
    await Promise.resolve()

    expect(response.writeHead).not.toHaveBeenCalled()
    expect(response.end).not.toHaveBeenCalled()
    expect(acceptPacket).not.toHaveBeenCalled()
  })

  it('keeps the bridge working after a client aborts a large upload', async () => {
    const body = packetBody(1024 * 1024)
    const payload = Buffer.from(body)
    const aborted = http.request({
      host: '127.0.0.1',
      port,
      path: COOKIE_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...profileHeaders(),
        'Content-Length': payload.byteLength,
        'x-hmac-signature': sign(body)
      }
    })
    aborted.on('error', () => undefined)
    aborted.write(payload.subarray(0, 256 * 1024))
    await new Promise<void>((resolve) => setTimeout(resolve, 20))
    aborted.destroy()

    const response = await post(packetBody(64))

    expect(response.status).toBe(200)
    expect(acceptPacket).toHaveBeenCalledTimes(1)
  })

  it('does not record a site for a packet that is not signed', async () => {
    const response = await post(oversizedBody(), 'a'.repeat(64))

    expect(response.status).toBe(401)
    expect(recordOversizedSiteSessionPacket).not.toHaveBeenCalled()
  })

  it('never registers a profile for an unsigned request', async () => {
    const body = JSON.stringify({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
    })

    const response = await post(body, 'a'.repeat(64))

    expect(response.status).toBe(401)
    // The Origin header is forgeable; liveness may be updated, but only a
    // signed request may add a profile the settings page offers as a source.
    expect(manager.markExtensionReachable).toHaveBeenCalled()
    expect(manager.markExtensionSeen).not.toHaveBeenCalled()
    expect(manager.markExtensionPaired).not.toHaveBeenCalled()
    expect(acceptPacket).not.toHaveBeenCalled()
  })

  it('registers the profile only after a valid signature', async () => {
    const body = JSON.stringify({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
    })

    const response = await post(body)

    expect(response.status).toBe(200)
    expect(manager.markExtensionSeen).toHaveBeenCalledWith(PROFILE_ID, 'Test Chrome')
    expect(manager.markExtensionPaired).toHaveBeenCalled()
  })

  it('does not register a profile from an unsigned health request', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: {
        Origin: EXTENSION_ORIGIN,
        'x-quizlab-profile-id': 'forged-profile-1234',
        'x-quizlab-profile-name': 'Forged'
      }
    })

    expect(response.status).toBe(200)
    expect(manager.markExtensionReachable).toHaveBeenCalled()
    expect(manager.markExtensionSeen).not.toHaveBeenCalled()
  })

  it('refuses a valid packet from a Chrome profile the user did not select', async () => {
    const body = JSON.stringify({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
    })

    const response = await postAs('other-profile-1234', body)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'not_selected',
      retryable: false
    })
    expect(acceptPacket).not.toHaveBeenCalled()
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

  it('does not report a failed import as a successful transfer', async () => {
    acceptPacket.mockResolvedValueOnce({
      accepted: true,
      imported: 0,
      failed: 1,
      importSucceeded: false,
      rolledBack: true,
      rollbackFailed: false,
      retryable: true
    })
    const body = JSON.stringify({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
    })

    const response = await post(body)

    expect(response.status).toBe(200)
    // The envelope was accepted, the import was not: the two answers are
    // separate fields instead of one optimistic `success`.
    await expect(response.json()).resolves.toEqual({
      success: false,
      accepted: true,
      importSucceeded: false,
      rolledBack: true,
      rollbackFailed: false,
      retryable: true,
      imported: 0,
      failed: 1
    })
  })

  it('reports a failed rollback as not retryable', async () => {
    acceptPacket.mockResolvedValueOnce({
      accepted: true,
      imported: 0,
      failed: 1,
      importSucceeded: false,
      rolledBack: true,
      rollbackFailed: true,
      retryable: false
    })
    const body = JSON.stringify({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
    })

    const response = await post(body)

    await expect(response.json()).resolves.toMatchObject({
      success: false,
      accepted: true,
      importSucceeded: false,
      rollbackFailed: true,
      retryable: false
    })
  })

  it('waits for the pairing write before it processes the first packet', async () => {
    let release!: () => void
    const pairing = new Promise<void>((resolve) => {
      release = resolve
    })
    const manager = createManager()
    manager.markExtensionPaired = vi.fn(() => pairing)
    const ownServer = http.createServer(createBridgeRequestHandler(manager))
    await new Promise<void>((resolve) => ownServer.listen(0, '127.0.0.1', resolve))
    const ownPort = (ownServer.address() as AddressInfo).port
    const body = JSON.stringify({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
    })

    try {
      const responsePromise = fetch(`http://127.0.0.1:${ownPort}${COOKIE_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...profileHeaders(),
          'x-hmac-signature': sign(body)
        },
        body,
        signal: AbortSignal.timeout(2000)
      })

      await vi.waitFor(() => expect(manager.markExtensionPaired).toHaveBeenCalled())
      // The first profile selection may still be writing to disk: the packet
      // must not run against a selection that is not committed yet.
      expect(acceptPacket).not.toHaveBeenCalled()

      release()
      const response = await responsePromise
      expect(response.status).toBe(200)
      expect(acceptPacket).toHaveBeenCalledTimes(1)
    } finally {
      await new Promise<void>((resolve) => ownServer.close(() => resolve()))
    }
  })

  it('answers the health check of the extension', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: { Origin: EXTENSION_ORIGIN }
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    // The extension uses the environment to tell the two running apps apart.
    expect(body).toMatchObject({ status: 'ok', environment: 'prod' })
    expect(body.secret).toBeUndefined()
  })

  it('refuses a request that names the other environment', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: { Origin: EXTENSION_ORIGIN, 'x-quizlab-environment': 'dev' }
    })

    expect(response.status).toBe(403)
  })

  it('answers a request that names its own environment', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: { Origin: EXTENSION_ORIGIN, 'x-quizlab-environment': 'prod' }
    })

    expect(response.status).toBe(200)
  })

  it('applies the origin check to the selector endpoints before routing them', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/selectors`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'x-quizlab-profile-id': PROFILE_ID },
      body: '{}'
    })

    expect(response.status).toBe(403)
    expect(handleSelectorBridgeRequest).not.toHaveBeenCalled()
  })

  it('refuses a selector request that names the other environment', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/selectors/sites`, {
      headers: { ...profileHeaders(), 'x-quizlab-environment': 'dev' }
    })

    expect(response.status).toBe(403)
    expect(handleSelectorBridgeRequest).not.toHaveBeenCalled()
  })

  it('hands a selector request of this environment to the selector router', async () => {
    handleSelectorBridgeRequest.mockImplementationOnce((_request, response) => {
      const res = response as {
        writeHead: (status: number, headers?: Record<string, string>) => void
        end: (body?: string) => void
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'saved' }))
      return true
    })

    const response = await fetch(`http://127.0.0.1:${port}/api/selectors`, {
      method: 'POST',
      headers: { ...profileHeaders(), 'x-quizlab-environment': 'prod' },
      body: '{}'
    })

    expect(response.status).toBe(200)
    expect(handleSelectorBridgeRequest).toHaveBeenCalledTimes(1)
  })

  it('answers the signed site list request', async () => {
    const response = await fetch(`http://127.0.0.1:${port}${SITE_LIST_PATH}`, {
      headers: {
        ...profileHeaders(),
        'x-hmac-signature': sign(SITE_LIST_PATH)
      }
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      selectedProfileId: PROFILE_ID,
      selectionVersion: 4
    })
  })

  it('opens one round for overlapping site list requests of one profile', async () => {
    let release!: (round: unknown) => void
    vi.mocked(openSiteSessionRound).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve as (round: unknown) => void
        }) as never
    )

    const siteList = () =>
      fetch(`http://127.0.0.1:${port}${SITE_LIST_PATH}`, {
        headers: { ...profileHeaders(), 'x-hmac-signature': sign(SITE_LIST_PATH) }
      })

    // The first request opens the round; the second arrives while it is still
    // being built and joins it instead of replacing the target list the first
    // request's packets are prepared against.
    const responses = Promise.all([siteList(), siteList()])
    await vi.waitFor(() => expect(openSiteSessionRound).toHaveBeenCalledTimes(1))
    release({ targets: [], accept: acceptPacket })

    const resolved = await responses
    expect(resolved.map((response) => response.status)).toEqual([200, 200])
    expect(vi.mocked(openSiteSessionRound)).toHaveBeenCalledTimes(1)
  })

  it('refuses a packet while the source is being switched', async () => {
    manager.isSelectionChanging = () => true
    const body = JSON.stringify({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
    })

    const response = await post(body)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'selection_changing',
      retryable: true
    })
    expect(acceptPacket).not.toHaveBeenCalled()

    // The old source is still the selected one while it is wiped, so its
    // packet waits for the switch — and a packet of the new source is not
    // selected yet.
    const other = await postAs('other-profile-1234', body)
    expect(other.status).toBe(403)
    await expect(other.json()).resolves.toEqual({ error: 'not_selected', retryable: false })
    expect(acceptPacket).not.toHaveBeenCalled()
  })

  it('refuses a packet while no profile is selected', async () => {
    // The first pairing writes the source; when that write fails there is no
    // answer to "whose session is this?", and importing it could mix two
    // Chrome profiles in one session.
    manager.getSelectedProfileId = () => null
    const body = JSON.stringify({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
    })

    const response = await post(body)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'selection_unavailable',
      retryable: true
    })
    expect(acceptPacket).not.toHaveBeenCalled()
  })

  it('marks a stale round as retryable and a disabled site as final', async () => {
    const body = JSON.stringify({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
    })

    acceptPacket.mockResolvedValueOnce({ accepted: false, reason: 'stale_round' })
    const stale = await post(body)
    expect(stale.status).toBe(409)
    await expect(stale.json()).resolves.toEqual({ error: 'stale_round', retryable: true })

    acceptPacket.mockResolvedValueOnce({ accepted: false, reason: 'target_disabled' })
    const disabled = await post(body)
    expect(disabled.status).toBe(403)
    await expect(disabled.json()).resolves.toEqual({
      error: 'target_disabled',
      retryable: false
    })
  })

  it('answers a legacy extension with protocol 1 so it reports itself outdated', async () => {
    const signature = createHmac('sha256', SECRET).update(SITE_LIST_PATH).digest('hex')
    const response = await fetch(`http://127.0.0.1:${port}${SITE_LIST_PATH}`, {
      headers: { Origin: EXTENSION_ORIGIN, 'x-hmac-signature': signature }
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      protocolVersion: 1,
      selectedProfileId: null
    })
  })
})

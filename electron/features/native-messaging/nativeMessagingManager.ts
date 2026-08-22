import type {
  ChromeExtensionCookie,
  NativeMessagingConnectionStatus,
  NativeMessagingExtensionInfo
} from '@shared-core/types'

import crypto from 'crypto'
import { app, BrowserWindow, session as electronSession } from 'electron'
import { promises as fs } from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'

import { APP_CONFIG } from '../../app/constants.js'
import { DEV_SERVER_ORIGIN } from '../../app/window/environment.js'
import { Logger } from '../../core/logger.js'
import { PROFILE_PARTITION } from '../gemini-web-session/sessionConfig.js'
import { importExternalCookies } from '../gemini-web-session/sessionCookies.js'
import { toExternalBrowserCookie } from './nativeMessagingCookieUtils.js'
import { NativeMessagingInstaller } from './nativeMessagingInstaller.js'
import {
  type BridgeOriginPolicy,
  isAllowedBridgeOrigin,
  validateCookieDomains
} from './nativeMessagingOrigin.js'
import { BRIDGE_PORT, HMAC_HEADER, MAX_COOKIE_BODY_SIZE } from './nativeMessagingTypes.js'

class NativeMessagingManager {
  private httpServer: http.Server | null = null
  private _connectionStatus: NativeMessagingConnectionStatus = 'disconnected'
  private _port: number = BRIDGE_PORT
  private _bridgeInfoExists = false
  private _waitingSince: number | null = null
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private _sharedSecret: string = crypto.randomBytes(32).toString('hex')
  private _extensionLastSeenAt: number = 0
  private _expectedExtensionOrigin: string | null = null
  private pendingBuffer: Buffer = Buffer.alloc(0)
  private readonly MAX_NATIVE_MESSAGE_SIZE = MAX_COOKIE_BODY_SIZE
  private stdinDataHandler: ((chunk: Buffer) => void) | null = null

  get connectionStatus(): NativeMessagingConnectionStatus {
    return this._connectionStatus
  }

  get port(): number {
    return this._port
  }

  get sharedSecret(): string {
    return this._sharedSecret
  }

  getExtensionInfo(): NativeMessagingExtensionInfo {
    return {
      status: this._connectionStatus,
      installed: this._bridgeInfoExists,
      error: this._connectionStatus === 'error' ? 'Bridge server not running' : undefined,
      waitingSince: this._waitingSince,
      userHint: this.computeUserHint()
    }
  }

  private computeUserHint(): string | null {
    if (!this._bridgeInfoExists) return null
    if (this._connectionStatus !== 'connecting') return null
    if (!this._waitingSince) return null

    const elapsed = Date.now() - this._waitingSince
    if (elapsed > 30000) {
      return 'waiting_long'
    }
    return 'waiting'
  }

  // -------------------------------------------------------------------------
  // Native Messaging stdio protocol - stream chunking (pendingBuffer)
  // Native Messaging spec: 4-byte LE uint32 length prefix + UTF-8 JSON body.
  // stdin chunks may be arbitrarily fragmented (TCP/pipe buffering), so we
  // accumulate into pendingBuffer and only parse when a full frame is available.
  // -------------------------------------------------------------------------

  /**
   * Accumulate incoming raw bytes and extract complete native messages.
   * Called for every `stdin` `data` chunk — handles split headers, split
   * bodies, and multiple messages coalesced in a single chunk.
   */
  public handleStdinData(chunk: Buffer): void {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as string)
    this.pendingBuffer = Buffer.concat([this.pendingBuffer, bufferChunk])
    this.processPendingBuffer()
  }

  /** Alias for tests / external callers that expect alternative naming */
  public onStdinData(chunk: Buffer): void {
    this.handleStdinData(chunk)
  }

  public handleNativeMessagingChunk(chunk: Buffer): void {
    this.handleStdinData(chunk)
  }

  private processPendingBuffer(): void {
    while (this.pendingBuffer.length >= 4) {
      let messageLength: number
      try {
        messageLength = this.pendingBuffer.readUInt32LE(0)
      } catch {
        Logger.error('[NativeMessaging] Failed to read message length, clearing buffer')
        this.pendingBuffer = Buffer.alloc(0)
        break
      }

      if (messageLength > this.MAX_NATIVE_MESSAGE_SIZE) {
        Logger.error(
          `[NativeMessaging] Native message too large (${messageLength} bytes), discarding buffer`
        )
        this.pendingBuffer = Buffer.alloc(0)
        break
      }

      if (this.pendingBuffer.length < 4 + messageLength) {
        break
      }

      const messageBody = this.pendingBuffer.subarray(4, 4 + messageLength)
      const remaining = this.pendingBuffer.subarray(4 + messageLength)
      this.pendingBuffer = remaining.length > 0 ? Buffer.from(remaining) : Buffer.alloc(0)

      try {
        const message = JSON.parse(messageBody.toString('utf-8'))
        void this.handleNativeMessage(message)
      } catch (err) {
        Logger.error('[NativeMessaging] Failed to parse native message JSON:', err)
      }
    }
  }

  private async handleNativeMessage(message: unknown): Promise<void> {
    try {
      const data = message as { cookies?: ChromeExtensionCookie[] }
      if (!data || !Array.isArray(data.cookies) || data.cookies.length === 0) {
        Logger.warn('[NativeMessaging] Received native message with no cookies')
        this.sendNativeMessage({ success: false, error: 'No cookies provided' })
        return
      }

      if (!validateCookieDomains(data.cookies)) {
        Logger.warn('[NativeMessaging] Rejected native message: invalid domain')
        this.sendNativeMessage({ success: false, error: 'Invalid cookie domain' })
        return
      }

      if (this._connectionStatus !== 'connected') {
        this._connectionStatus = 'connected'
        this._waitingSince = null
        this._extensionLastSeenAt = Date.now()
        this.broadcastExtensionConnected()
      }
      this._extensionLastSeenAt = Date.now()

      const externalCookies = data.cookies.map(toExternalBrowserCookie)
      const targetSession = electronSession.fromPartition(PROFILE_PARTITION)
      await importExternalCookies(targetSession, externalCookies)
      this.sendNativeMessage({ success: true, imported: data.cookies.length })
    } catch (err) {
      Logger.error('[NativeMessaging] Failed to handle native message:', err)
      this.sendNativeMessage({ success: false, error: 'Internal error' })
    }
  }

  private sendNativeMessage(message: unknown): void {
    try {
      const json = JSON.stringify(message)
      const body = Buffer.from(json, 'utf-8')
      const header = Buffer.alloc(4)
      header.writeUInt32LE(body.length, 0)
      const output = Buffer.concat([header, body])
      if (process.stdout.writable) {
        process.stdout.write(output)
      }
    } catch (err) {
      Logger.error('[NativeMessaging] Failed to send native message:', err)
    }
  }

  public startNativeMessagingListener(): void {
    if (this.stdinDataHandler) return
    this.stdinDataHandler = (chunk: Buffer) => this.handleStdinData(chunk)
    process.stdin.on('data', this.stdinDataHandler as unknown as (chunk: string) => void)
    if (typeof (process.stdin as unknown as { resume?: () => void }).resume === 'function') {
      ;(process.stdin as unknown as { resume: () => void }).resume()
    }
  }

  public stopNativeMessagingListener(): void {
    if (this.stdinDataHandler) {
      process.stdin.off('data', this.stdinDataHandler as unknown as (chunk: string) => void)
      this.stdinDataHandler = null
    }
    this.pendingBuffer = Buffer.alloc(0)
  }

  /** Test helper: expose pending buffer length without leaking internal Buffer */
  public getPendingBufferLength(): number {
    return this.pendingBuffer.length
  }

  /** Test helper: reset buffer between isolated tests */
  public resetPendingBuffer(): void {
    this.pendingBuffer = Buffer.alloc(0)
  }

  async initialize(): Promise<void> {
    await this.loadExpectedExtensionOrigin()
    await this.startServer()

    const bridgeInfoPath = NativeMessagingInstaller.resolveBridgeInfoPath()
    this._bridgeInfoExists = await fs
      .stat(bridgeInfoPath)
      .then(() => true)
      .catch(() => false)
  }

  private async loadExpectedExtensionOrigin(): Promise<void> {
    this._expectedExtensionOrigin = await NativeMessagingInstaller.deriveExtensionOrigin()
    if (this._expectedExtensionOrigin) {
      Logger.info(`[NativeMessaging] Expected extension origin: ${this._expectedExtensionOrigin}`)
    }
  }

  async installExtension(): Promise<{
    success: boolean
    error?: string
    installedPath?: string
  }> {
    const result = await NativeMessagingInstaller.install(this._port, this._expectedExtensionOrigin)
    if (result.success) {
      this._bridgeInfoExists = true
    }
    return result
  }

  async removeExtension(): Promise<{ success: boolean; error?: string }> {
    this._connectionStatus = 'disconnected'
    this._waitingSince = null
    this._bridgeInfoExists = false
    return NativeMessagingInstaller.remove()
  }

  private startServer(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.httpServer?.listening) {
        resolve()
        return
      }

      this.httpServer = http.createServer((req, res) => {
        this.handleRequest(req, res)
      })

      this.httpServer.listen(this._port, '127.0.0.1', () => {
        const addr = this.httpServer?.address() as AddressInfo
        this._port = addr?.port || this._port
        this._connectionStatus = 'connecting'
        this._waitingSince = Date.now()
        this.startHealthCheck()
        resolve()
      })

      this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          this._port++
          this.startServer().then(resolve)
          return
        }
        this._connectionStatus = 'error'
        this._waitingSince = null
        resolve()
      })
    })
  }

  stopServer(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    if (this.httpServer) {
      this.httpServer.close()
      this.httpServer = null
    }
    this._connectionStatus = 'disconnected'
    this._waitingSince = null
    this.stopNativeMessagingListener()
  }

  private getOriginPolicy(): BridgeOriginPolicy {
    const isDev = !app.isPackaged
    return {
      expectedExtensionOrigin: this._expectedExtensionOrigin,
      allowedDevOrigins: isDev && DEV_SERVER_ORIGIN ? [DEV_SERVER_ORIGIN] : [],
      isDev
    }
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const requestOrigin = req.headers.origin
    const originAllowed = isAllowedBridgeOrigin(requestOrigin, this.getOriginPolicy())

    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hmac-signature, x-bridge-secret')
    res.setHeader('Vary', 'Origin')
    if (originAllowed && requestOrigin) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    }

    if (req.method === 'OPTIONS') {
      if (!originAllowed) {
        this.rejectDisallowedOrigin(res, requestOrigin)
        return
      }
      res.writeHead(204)
      res.end()
      return
    }

    if (!originAllowed) {
      this.rejectDisallowedOrigin(res, requestOrigin)
      return
    }

    if (req.method === 'GET' && req.url === '/api/health') {
      this._extensionLastSeenAt = Date.now()
      Logger.info(`[NativeMessaging] Served bridge shared secret to origin: ${requestOrigin}`)
      const healthResponse: Record<string, unknown> = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        secret: this._sharedSecret
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(healthResponse))
      return
    }

    if (req.method === 'POST' && req.url === '/api/cookies') {
      this.handleCookiePost(req, res)
      return
    }

    res.writeHead(404)
    res.end('Not found')
  }

  private rejectDisallowedOrigin(res: http.ServerResponse, origin: string | undefined): void {
    Logger.warn(`[NativeMessaging] Rejected request from disallowed origin: ${origin || '(none)'}`)
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Forbidden' }))
  }

  private handleCookiePost(req: http.IncomingMessage, res: http.ServerResponse): void {
    const signature = req.headers[HMAC_HEADER] as string | undefined
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
        // Guard the length BEFORE timingSafeEqual: comparing buffers of
        // different lengths throws ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH, which
        // would surface as a misleading 500 instead of a 401.
        const expectedSig = crypto
          .createHmac('sha256', this._sharedSecret)
          .update(body)
          .digest('hex')
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

        if (this._connectionStatus !== 'connected') {
          this._connectionStatus = 'connected'
          this._waitingSince = null
          this._extensionLastSeenAt = Date.now()
          this.broadcastExtensionConnected()
        }

        this._extensionLastSeenAt = Date.now()

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

  private startHealthCheck(): void {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval)

    this.healthCheckInterval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - this._extensionLastSeenAt

      if (this._connectionStatus === 'connected' && elapsed > 120000) {
        this._connectionStatus = 'connecting'
        this._waitingSince = Date.now()
        this.broadcastExtensionDisconnected()
      }

      if (this._connectionStatus === 'connecting' && !this._bridgeInfoExists) {
        this._connectionStatus = 'disconnected'
        this._waitingSince = null
      }
    }, 30000)
  }

  private broadcastExtensionConnected(): void {
    const allWindows = BrowserWindow.getAllWindows()
    for (const win of allWindows) {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_CONNECTED)
      }
    }
  }

  broadcastExtensionDisconnected(): void {
    const allWindows = BrowserWindow.getAllWindows()
    for (const win of allWindows) {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_DISCONNECTED)
      }
    }
  }

  dispose(): void {
    this.stopServer()
    this.stopNativeMessagingListener()
  }
}

export const nativeMessagingManager = new NativeMessagingManager()

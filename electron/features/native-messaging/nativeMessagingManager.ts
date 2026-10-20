import type {
  NativeMessagingConnectionStatus,
  NativeMessagingExtensionInfo
} from '@shared-core/types'

import crypto from 'crypto'
import { BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'

import { APP_CONFIG } from '../../app/constants.js'
import { Logger } from '../../core/logger.js'
import {
  acceptSiteSessionPacket,
  parseSiteSessionPacket
} from '../web-session/siteSessionBridge.js'
import { createBridgeRequestHandler } from './nativeMessagingBridgeHandler.js'
import { NativeMessagingInstaller } from './nativeMessagingInstaller.js'
import { BRIDGE_PORT, MAX_COOKIE_BODY_SIZE } from './nativeMessagingTypes.js'

class NativeMessagingManager {
  private httpServer: http.Server | null = null
  private _connectionStatus: NativeMessagingConnectionStatus = 'disconnected'
  private _port: number = BRIDGE_PORT
  private _bridgeInfoExists = false
  private _waitingSince: number | null = null
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private _sharedSecret: string = crypto.randomBytes(32).toString('hex')
  private _extensionLastSeenAt: number = 0
  private _extensionProtocolVersion: number | null = null
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

  /**
   * The protocol version the extension reported, or null when it reported none.
   *
   * The extension names the protocol it speaks in every request it makes to
   * the bridge. An extension that reports nothing is an extension the user
   * has to reload: it may be an old copy that predates the handshake.
   */
  getExtensionProtocolVersion(): number | null {
    return this._extensionProtocolVersion
  }

  /**
   * Forgets the protocol version of the extension that is gone.
   *
   * A version that outlived its extension would tell the settings page that
   * an extension is ready while none is talking to the app.
   */
  private forgetExtensionProtocolVersion(): void {
    this._extensionProtocolVersion = null
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

  // Native Messaging stdio protocol - stream chunking (pendingBuffer)
  // Native Messaging spec: 4-byte LE uint32 length prefix + UTF-8 JSON body.
  // stdin chunks may be arbitrarily fragmented (TCP/pipe buffering), so we
  // accumulate into pendingBuffer and only parse when a full frame is available.

  /**
   * Accumulate incoming raw bytes and extract complete native messages.
   * Called for every `stdin` `data` chunk — handles split headers, split
   * bodies, and multiple messages coalesced in a single chunk.
   */
  public handleStdinData(chunk: Buffer): void {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as string)
    this.pendingBuffer = Buffer.concat([this.pendingBuffer, bufferChunk])
    // Global cap: slow-drip or coalesced chunks must not exceed MAX + header
    if (this.pendingBuffer.length > this.MAX_NATIVE_MESSAGE_SIZE + 4 + 1024) {
      Logger.error('[NativeMessaging] Pending buffer overflow, discarding')
      this.pendingBuffer = Buffer.alloc(0)
      return
    }
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
        // Slow-drip guard: if we have a valid length but body never completes,
        // the global cap in handleStdinData will eventually discard.
        break
      }

      const messageBody = this.pendingBuffer.subarray(4, 4 + messageLength)
      const remaining = this.pendingBuffer.subarray(4 + messageLength)
      // Copy to free the original large backing buffer (subarray shares memory)
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
      const packet = parseSiteSessionPacket(JSON.stringify(message))
      if (!packet) {
        Logger.warn('[NativeMessaging] Received a native message that is not a site session packet')
        this.sendNativeMessage({ success: false, error: 'Malformed packet' })
        return
      }

      if (this._connectionStatus !== 'connected') {
        this._connectionStatus = 'connected'
        this._waitingSince = null
        this._extensionLastSeenAt = Date.now()
        this.broadcastExtensionConnected()
      }
      this._extensionLastSeenAt = Date.now()

      const outcome = await acceptSiteSessionPacket(packet)
      if (!outcome.accepted) {
        this.sendNativeMessage({ success: false, error: outcome.reason })
        return
      }
      this.sendNativeMessage({ success: true, imported: outcome.imported ?? 0 })
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
    this.forgetExtensionProtocolVersion()
    return NativeMessagingInstaller.remove()
  }

  private startServer(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.httpServer?.listening) {
        resolve()
        return
      }

      this.httpServer = http.createServer(createBridgeRequestHandler(this))

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
      const server = this.httpServer
      this.httpServer = null
      try {
        server.close()
      } catch {
        // close() on an already-closing server must not break dispose()
      }
      // Listener cleanup must never skip the close() above: a throwing
      // removeAllListeners would otherwise leak the server (and break
      // consumers whose server doubles lack the EventEmitter API).
      try {
        server.removeAllListeners()
      } catch {
        // Non-EventEmitter server doubles or already-disposed servers.
      }
    }
    this._connectionStatus = 'disconnected'
    this._waitingSince = null
    this.forgetExtensionProtocolVersion()
    this.stopNativeMessagingListener()
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval)

    this.healthCheckInterval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - this._extensionLastSeenAt

      if (this._connectionStatus === 'connected' && elapsed > 120000) {
        this._connectionStatus = 'connecting'
        this._waitingSince = Date.now()
        this.forgetExtensionProtocolVersion()
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

import type {
  NativeMessagingConnectionStatus,
  NativeMessagingExtensionInfo
} from '@shared-core/types'

import crypto from 'crypto'
import { BrowserWindow } from 'electron'
import http from 'http'
import type { AddressInfo } from 'net'

import { QUIZLAB_EXTENSION_ORIGIN } from '../../../shared/constants/extensionRelease.js'
import { APP_CONFIG } from '../../app/constants.js'
import { Logger } from '../../core/logger.js'
import { createBridgeRequestHandler } from './nativeMessagingBridgeHandler.js'
import { NativeMessagingCredentials } from './nativeMessagingCredentials.js'
import { BRIDGE_PORT, BRIDGE_PORT_RANGE_END } from './nativeMessagingTypes.js'

class NativeMessagingManager {
  private httpServer: http.Server | null = null
  private _connectionStatus: NativeMessagingConnectionStatus = 'disconnected'
  private _port: number = BRIDGE_PORT
  private _paired = false
  private _waitingSince: number | null = null
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private _sharedSecret: string = crypto.randomBytes(32).toString('hex')
  private readonly _instanceId: string = crypto.randomBytes(16).toString('hex')
  private _extensionLastSeenAt: number = 0
  private _extensionProtocolVersion: number | null = null
  private _expectedExtensionOrigin: string | null = null

  get connectionStatus(): NativeMessagingConnectionStatus {
    return this._connectionStatus
  }

  get port(): number {
    return this._port
  }

  /** Identifies this running bridge; the health answer carries it. */
  get instanceId(): string {
    return this._instanceId
  }

  getExtensionInfo(): NativeMessagingExtensionInfo {
    return {
      status: this._connectionStatus,
      paired: this._paired,
      error: this._connectionStatus === 'error' ? 'Bridge server not running' : undefined,
      waitingSince: this._waitingSince,
      userHint: this.computeUserHint()
    }
  }

  /**
   * The code the user copies into the extension popup.
   *
   * It is the signing secret itself. The settings UI shows it behind an
   * explicit action; it never travels on the HTTP bridge.
   */
  getPairingCode(): string {
    return this._sharedSecret
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
    if (this._connectionStatus !== 'connecting') return null
    if (!this._waitingSince) return null

    const elapsed = Date.now() - this._waitingSince
    if (elapsed > 30000) {
      return 'waiting_long'
    }
    return 'waiting'
  }

  /**
   * Remembers that the extension is talking to the app.
   *
   * The connection is kept alive by the traffic itself: the extension pushes
   * its packets only when something changed, so the app learns that the
   * extension is there from the requests that arrive, not from a heartbeat of
   * its own. The bridge calls this for every request that passed the origin
   * check.
   */
  markExtensionSeen(): void {
    const wasConnected = this._connectionStatus === 'connected'
    this._extensionLastSeenAt = Date.now()
    if (wasConnected) return

    this._connectionStatus = 'connected'
    this._waitingSince = null
    this.broadcastExtensionConnected()
  }

  /**
   * Remembers that the extension proved it holds the pairing code.
   *
   * The settings page uses this to tell an extension that is installed but
   * not paired from one that is ready to import.
   */
  markExtensionPaired(): void {
    this._paired = true
  }

  async initialize(): Promise<void> {
    // The secret is persisted once and paired with the extension by hand. It
    // is never handed out over HTTP: an HTTP response can be read by any local
    // process that can forge the Origin header, which would defeat the
    // signature it is supposed to enable.
    this._sharedSecret = await NativeMessagingCredentials.loadOrCreateSharedSecret()
    this._expectedExtensionOrigin = QUIZLAB_EXTENSION_ORIGIN
    Logger.info(`[NativeMessaging] Expected extension origin: ${this._expectedExtensionOrigin}`)
    await this.startServer()
  }

  private startServer(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.httpServer?.listening) {
        resolve()
        return
      }

      const server = http.createServer(createBridgeRequestHandler(this))
      this.httpServer = server

      server.listen(this._port, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo
        this._port = addr?.port || this._port
        this._connectionStatus = 'connecting'
        this._waitingSince = Date.now()
        this.startHealthCheck()
        resolve()
      })

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          // The failed instance is no longer usable: close it and drop its
          // listeners before trying the next port. A callback is passed to
          // close() because a server that never listened would otherwise emit
          // an unhandled `error` event after its listeners were removed.
          this.disposeFailedServer(server)

          if (this._port >= BRIDGE_PORT_RANGE_END) {
            Logger.error(
              `[NativeMessaging] No available port in range ${BRIDGE_PORT}-${BRIDGE_PORT_RANGE_END}`
            )
            this._connectionStatus = 'error'
            this._waitingSince = null
            resolve()
            return
          }

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

  /** Closes a server that could not bind and empties the manager's slot. */
  private disposeFailedServer(server: http.Server): void {
    if (this.httpServer === server) this.httpServer = null
    try {
      server.close(() => {
        try {
          server.removeAllListeners()
        } catch {
          // Non-EventEmitter test doubles.
        }
      })
    } catch {
      try {
        server.removeAllListeners()
      } catch {
        // Already disposed.
      }
    }
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

      if (this._connectionStatus === 'connecting' && elapsed > 120000) {
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
  }
}

export const nativeMessagingManager = new NativeMessagingManager()

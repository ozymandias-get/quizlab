import type {
  ChromeExtensionCookie,
  NativeMessagingConnectionStatus,
  NativeMessagingExtensionInfo
} from '@shared-core/types'

import { execFile } from 'child_process'
import crypto from 'crypto'
import { app, BrowserWindow, clipboard, session as electronSession } from 'electron'
import { promises as fs } from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import path from 'path'
import { promisify } from 'util'

import { APP_CONFIG } from '../../app/constants.js'
import { DEV_SERVER_ORIGIN } from '../../app/window/environment.js'
import { Logger } from '../../core/logger.js'
import { PROFILE_PARTITION } from '../gemini-web-session/sessionConfig.js'
import { importExternalCookies } from '../gemini-web-session/sessionCookies.js'
import { toExternalBrowserCookie } from './nativeMessagingCookieUtils.js'
import {
  type BridgeOriginPolicy,
  deriveExtensionIdFromKey,
  isAllowedBridgeOrigin,
  validateCookieDomains
} from './nativeMessagingOrigin.js'
import {
  BRIDGE_PORT,
  BRIDGE_SECRET_HEADER,
  CRITICAL_COOKIE_NAMES,
  EXTENSION_SOURCE_DIR,
  HMAC_HEADER,
  MAX_COOKIE_BODY_SIZE,
  NATIVE_HOST_MANIFEST_NAME
} from './nativeMessagingTypes.js'

const execFileAsync = promisify(execFile)

const NATIVE_HOST_REGISTRY_KEY = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_MANIFEST_NAME}`

/**
 * SECURITY: The registry `path` value of a native messaging host manifest is
 * read by Chromium from a JSON file. Backslashes in that JSON must be escaped
 * (`\\`) or Chrome reports "Specified native messaging host not found".
 * Windows accepts forward slashes in file paths, so we emit them instead of
 * backslashes and sidestep the escaping pitfall entirely — both in the JSON
 * content and in the manifest file name.
 */
function toForwardSlashPath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

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

  async initialize(): Promise<void> {
    await this.loadExpectedExtensionOrigin()
    await this.startServer()

    const bridgeInfoPath = this.resolveBridgeInfoPath()
    this._bridgeInfoExists = await fs
      .stat(bridgeInfoPath)
      .then(() => true)
      .catch(() => false)
  }

  private async loadExpectedExtensionOrigin(): Promise<void> {
    this._expectedExtensionOrigin = await this.deriveExtensionOrigin()
    if (this._expectedExtensionOrigin) {
      Logger.info(`[NativeMessaging] Expected extension origin: ${this._expectedExtensionOrigin}`)
    }
  }

  private async deriveExtensionOrigin(): Promise<string | null> {
    try {
      const manifestPath = path.join(this.resolveSourceExtensionPath(), 'manifest.json')
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as { key?: string }
      if (manifest.key) {
        return `chrome-extension://${deriveExtensionIdFromKey(manifest.key)}`
      }
    } catch (error) {
      Logger.error('[NativeMessaging] Failed to derive extension origin from manifest:', error)
    }
    return null
  }

  async installExtension(): Promise<{
    success: boolean
    error?: string
    installedPath?: string
  }> {
    try {
      const srcPath = this.resolveSourceExtensionPath()
      const extExists = await fs
        .stat(srcPath)
        .then(() => true)
        .catch(() => false)
      if (!extExists) {
        return { success: false, error: `Extension not found at: ${srcPath}` }
      }

      const destPath = this.resolveInstalledExtensionPath()
      await this.copyDir(srcPath, destPath)

      const bridgeInfoPath = this.resolveBridgeInfoPath()
      const bridgeInfo = {
        port: this._port,
        host: '127.0.0.1',
        endpoints: { cookies: '/api/cookies', health: '/api/health' }
      }
      await fs.mkdir(path.dirname(bridgeInfoPath), { recursive: true })
      await fs.writeFile(bridgeInfoPath, JSON.stringify(bridgeInfo, null, 2), 'utf-8')
      this._bridgeInfoExists = true

      // Write the native messaging host manifest with a forward-slash
      // executable path so the JSON never needs backslash escaping (a
      // backslash must be written as `\\` inside JSON, and a single `\`
      // makes Chrome report "Specified native messaging host not found").
      const nativeHostManifestPath = path.join(destPath, `${NATIVE_HOST_MANIFEST_NAME}.json`)
      const nativeHostManifest = {
        name: NATIVE_HOST_MANIFEST_NAME,
        description: 'Quizlab Reader native messaging host (HTTP bridge)',
        path: toForwardSlashPath(process.execPath),
        type: 'stdio',
        allowed_origins: this._expectedExtensionOrigin ? [`${this._expectedExtensionOrigin}/`] : []
      }
      await fs.writeFile(
        nativeHostManifestPath,
        JSON.stringify(nativeHostManifest, null, 2),
        'utf-8'
      )
      await this.registerNativeHostInRegistry(nativeHostManifestPath)

      clipboard.writeText(destPath)

      return { success: true, installedPath: destPath }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  }

  async removeExtension(): Promise<{ success: boolean; error?: string }> {
    try {
      this._connectionStatus = 'disconnected'
      this._waitingSince = null
      this._bridgeInfoExists = false

      const bridgeInfoPath = this.resolveBridgeInfoPath()
      await fs.rm(bridgeInfoPath, { force: true })

      const extPath = this.resolveInstalledExtensionPath()
      await fs.rm(extPath, { recursive: true, force: true })

      await this.unregisterNativeHostFromRegistry()

      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  }

  /**
   * Registers the native messaging host in HKCU so Chrome resolves
   * `com.quizlab.reader` to the manifest written by `installExtension`.
   * Best-effort: a failure must not fail the whole extension install.
   */
  private async registerNativeHostInRegistry(manifestPath: string): Promise<void> {
    if (process.platform !== 'win32') return
    try {
      // `reg add` receives the path as a single argv entry (no shell), so the
      // backslashes are stored literally — exactly what Chrome expects.
      await execFileAsync('reg', ['add', NATIVE_HOST_REGISTRY_KEY, '/ve', '/d', manifestPath, '/f'])
    } catch (error) {
      Logger.warn('[NativeMessaging] Failed to register native host in registry:', error)
    }
  }

  private async unregisterNativeHostFromRegistry(): Promise<void> {
    if (process.platform !== 'win32') return
    try {
      await execFileAsync('reg', ['delete', NATIVE_HOST_REGISTRY_KEY, '/f'])
    } catch (error) {
      Logger.warn('[NativeMessaging] Failed to remove native host registry key:', error)
    }
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
  }

  // SECURITY: Policy is evaluated per request so tests and env overrides
  // (APP_RENDERER_URL) take effect without a global environment system.
  private getOriginPolicy(): BridgeOriginPolicy {
    const isDev = !app.isPackaged
    return {
      expectedExtensionOrigin: this._expectedExtensionOrigin,
      // Exact dev server origin (default http://localhost:5173, derived from
      // the Vite config; overridable via APP_RENDERER_URL). Never "any port".
      allowedDevOrigins: isDev && DEV_SERVER_ORIGIN ? [DEV_SERVER_ORIGIN] : [],
      isDev
    }
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const requestOrigin = req.headers.origin
    // SECURITY: Origin policy runs before anything else (including OPTIONS
    // preflights) — the health endpoint hands out the shared secret, so only
    // allowlisted origins may talk to the bridge at all. Cookie POSTs are
    // additionally HMAC-verified via a per-session secret; bridge listens on
    // 127.0.0.1 only.
    const originAllowed = isAllowedBridgeOrigin(requestOrigin, this.getOriginPolicy())

    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hmac-signature, x-bridge-secret')
    res.setHeader('Vary', 'Origin')
    // SECURITY: Never use a wildcard. Echo the exact allowlisted origin so
    // only allowed callers can read responses (e.g. the shared secret); for
    // disallowed origins no ACAO header is emitted at all.
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
    // SECURITY: Without the HMAC check, a local process could impersonate the extension.
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
      // SECURITY: Cap payload size to prevent OOM attacks from the bridge.
      if (bodySize > MAX_COOKIE_BODY_SIZE) {
        req.destroy()
        Logger.warn('[NativeMessaging] Rejected oversized cookie payload')
        return
      }
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        // SECURITY: Verify the HMAC signature so only the paired extension can send cookies.
        const expectedSig = crypto
          .createHmac('sha256', this._sharedSecret)
          .update(body)
          .digest('hex')
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
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

  private resolveSourceExtensionPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, EXTENSION_SOURCE_DIR)
    }
    return path.join(app.getAppPath(), EXTENSION_SOURCE_DIR)
  }

  private resolveInstalledExtensionPath(): string {
    return path.join(app.getPath('userData'), 'extensions', 'quizlab-session-extension')
  }

  private resolveBridgeInfoPath(): string {
    return path.join(app.getPath('userData'), 'chrome-bridge-info.json')
  }

  private async copyDir(src: string, dest: string): Promise<void> {
    await fs.rm(dest, { recursive: true, force: true })
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }

  dispose(): void {
    this.stopServer()
  }
}

export const nativeMessagingManager = new NativeMessagingManager()

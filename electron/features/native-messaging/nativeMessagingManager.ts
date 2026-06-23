import type {
  ChromeExtensionCookie,
  NativeMessagingConnectionStatus,
  NativeMessagingExtensionInfo
} from '@shared-core/types'

import crypto from 'crypto'
import { app, BrowserWindow, clipboard, session as electronSession } from 'electron'
import { promises as fs } from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import path from 'path'

import { APP_CONFIG } from '../../app/constants'
import { Logger } from '../../core/logger'
import { PROFILE_PARTITION } from '../gemini-web-session/sessionConfig'
import { importExternalCookies } from '../gemini-web-session/sessionCookies'
import { geminiWebSessionManager } from '../gemini-web-session/sessionManager'
import {
  BRIDGE_PORT,
  BRIDGE_SECRET_HEADER,
  CRITICAL_COOKIE_NAMES,
  EXTENSION_SOURCE_DIR,
  HMAC_HEADER,
  isAllowedOrigin,
  MAX_COOKIE_BODY_SIZE
} from './nativeMessagingTypes'

class NativeMessagingManager {
  private httpServer: http.Server | null = null
  private _connectionStatus: NativeMessagingConnectionStatus = 'disconnected'
  private _port: number = BRIDGE_PORT
  private _extensionLastSeenAt: number = 0
  private _bridgeInfoExists = false
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private _sharedSecret: string = crypto.randomBytes(32).toString('hex')

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
      error: this._connectionStatus === 'error' ? 'Bridge server not running' : undefined
    }
  }

  async initialize(): Promise<void> {
    this.startServer()

    const bridgeInfoPath = this.resolveBridgeInfoPath()
    this._bridgeInfoExists = await fs
      .stat(bridgeInfoPath)
      .then(() => true)
      .catch(() => false)
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
        secret: this._sharedSecret,
        endpoints: {
          cookies: '/api/cookies',
          health: '/api/health'
        }
      }
      await fs.mkdir(path.dirname(bridgeInfoPath), { recursive: true })
      await fs.writeFile(bridgeInfoPath, JSON.stringify(bridgeInfo, null, 2), 'utf-8')
      this._bridgeInfoExists = true

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
      this._bridgeInfoExists = false

      const bridgeInfoPath = this.resolveBridgeInfoPath()
      await fs.rm(bridgeInfoPath, { force: true })

      const extPath = this.resolveInstalledExtensionPath()
      await fs.rm(extPath, { recursive: true, force: true })

      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  }

  private startServer(): void {
    if (this.httpServer?.listening) return

    this.httpServer = http.createServer((req, res) => {
      this.handleRequest(req, res)
    })

    this.httpServer.listen(this._port, '127.0.0.1', () => {
      const addr = this.httpServer?.address() as AddressInfo
      this._port = addr?.port || this._port
      this._connectionStatus = 'connecting'
      this.startHealthCheck()
    })

    this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        this._port++
        this.startServer()
        return
      }
      this._connectionStatus = 'error'
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
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // SECURITY: Restrict CORS to chrome-extension:// origins only.
    // An open wildcard (*) would allow any website or local process to
    // communicate with this bridge, potentially sending malicious cookies.
    const origin = req.headers['origin'] as string | undefined
    if (origin && !isAllowedOrigin(origin)) {
      Logger.warn('[NativeMessaging] Blocked request from disallowed origin:', origin)
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    const allowedOrigins = origin || 'chrome-extension://'
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins)
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hmac-signature, x-bridge-secret')
    res.setHeader('Vary', 'Origin')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === 'GET' && req.url === '/api/health') {
      // SECURITY: Return the shared secret so the extension can
      // authenticate subsequent requests. Bound to 127.0.0.1 so only
      // local processes can read it. The extension stores this in
      // chrome.storage.session for the lifetime of the service worker.
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          secret: this._sharedSecret
        })
      )
      return
    }

    if (req.method === 'POST' && req.url === '/api/cookies') {
      this.handleCookiePost(req, res)
      return
    }

    res.writeHead(404)
    res.end('Not found')
  }

  private handleCookiePost(req: http.IncomingMessage, res: http.ServerResponse): void {
    // SECURITY: Verify HMAC signature on cookie POST requests.
    // Without this check, any local process could impersonate the extension
    // and inject malicious cookies into the Gemini session partition.
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
      // SECURITY: Enforce maximum body size to prevent OOM attacks.
      // A compromised extension or local process could send an arbitrarily
      // large payload to exhaust bridge process memory.
      if (bodySize > MAX_COOKIE_BODY_SIZE) {
        req.destroy()
        Logger.warn('[NativeMessaging] Rejected oversized cookie payload')
        return
      }
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        // SECURITY: Verify HMAC signature using the shared secret.
        // This ensures only the paired extension can send cookies.
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

        if (this._connectionStatus !== 'connected') {
          this._connectionStatus = 'connected'
          this._extensionLastSeenAt = Date.now()
          this.broadcastExtensionConnected()
        }

        this._extensionLastSeenAt = Date.now()

        const externalCookies = cookies.map(toExternalBrowserCookie)
        const targetSession = electronSession.fromPartition(PROFILE_PARTITION)
        await importExternalCookies(targetSession, externalCookies)

        await geminiWebSessionManager.checkNow()

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

      if (this._connectionStatus === 'connected' && elapsed > 60000) {
        this._connectionStatus = 'connecting'
        this.broadcastExtensionDisconnected()
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

function toExternalBrowserCookie(cookie: ChromeExtensionCookie): {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite?: 'Strict' | 'Lax' | 'None' | 'Unspecified'
  expires?: number
} {
  const sameSiteMap: Record<string, 'Strict' | 'Lax' | 'None' | 'Unspecified'> = {
    strict: 'Strict',
    lax: 'Lax',
    no_restriction: 'None'
  }
  const ss = cookie.sameSite
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    sameSite: ss ? sameSiteMap[ss] : undefined,
    expires: cookie.expires
  }
}

export const nativeMessagingManager = new NativeMessagingManager()

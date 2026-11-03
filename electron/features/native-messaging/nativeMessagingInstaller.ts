import crypto from 'crypto'
import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

import { Logger } from '../../core/logger.js'
import { writeClipboardText } from '../../core/systemHandlers/clipboardApi.js'
import { deriveExtensionIdFromKey } from './nativeMessagingOrigin.js'
import { EXTENSION_SOURCE_DIR } from './nativeMessagingTypes.js'

/** The file the extension reads its bridge secret from, inside its own dir. */
const EXTENSION_SECRET_FILE = 'bridge-secret.json'

export class NativeMessagingInstaller {
  static resolveSourceExtensionPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, EXTENSION_SOURCE_DIR)
    }
    return path.join(app.getAppPath(), EXTENSION_SOURCE_DIR)
  }

  static resolveInstalledExtensionPath(): string {
    return path.join(app.getPath('userData'), 'extensions', 'quizlab-session-extension')
  }

  static resolveBridgeInfoPath(): string {
    return path.join(app.getPath('userData'), 'chrome-bridge-info.json')
  }

  /** The app-side copy of the shared secret. */
  static resolveSharedSecretPath(): string {
    return path.join(app.getPath('userData'), 'bridge-secret.json')
  }

  /**
   * Reads the persisted bridge secret, creating it once when it is missing.
   *
   * The secret must survive an app restart: the installed extension keeps the
   * copy it was given and signs every request with it. A new secret on every
   * start would make every stored copy stale.
   */
  static async loadOrCreateSharedSecret(): Promise<string> {
    const secretPath = this.resolveSharedSecretPath()
    try {
      const raw = await fs.readFile(secretPath, 'utf-8')
      const parsed = JSON.parse(raw) as { secret?: unknown }
      if (typeof parsed.secret === 'string' && /^[0-9a-f]{64}$/.test(parsed.secret)) {
        return parsed.secret
      }
    } catch {
      // Missing or unreadable: fall through and create a fresh one.
    }

    const secret = crypto.randomBytes(32).toString('hex')
    await fs.mkdir(path.dirname(secretPath), { recursive: true })
    await fs.writeFile(secretPath, JSON.stringify({ secret }, null, 2), {
      encoding: 'utf-8',
      mode: 0o600
    })
    return secret
  }

  static async deriveExtensionOrigin(): Promise<string | null> {
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

  static async copyDir(src: string, dest: string): Promise<void> {
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

  static async install(port: number): Promise<{
    success: boolean
    error?: string
    installedPath?: string
    secret?: string
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

      // Create the secret only after the source is known to exist: a missing
      // extension must not leave half an install behind.
      const sharedSecret = await this.loadOrCreateSharedSecret()
      const destPath = this.resolveInstalledExtensionPath()
      await this.copyDir(srcPath, destPath)

      // The extension cannot read outside its own package, so the secret is
      // placed next to its manifest. The service worker fetches it through
      // `chrome.runtime.getURL`; it never travels over HTTP.
      await fs.writeFile(
        path.join(destPath, EXTENSION_SECRET_FILE),
        JSON.stringify({ secret: sharedSecret }, null, 2),
        'utf-8'
      )

      const bridgeInfoPath = this.resolveBridgeInfoPath()
      const bridgeInfo = {
        port,
        host: '127.0.0.1',
        endpoints: { cookies: '/api/cookies', health: '/api/health' }
      }
      await fs.mkdir(path.dirname(bridgeInfoPath), { recursive: true })
      await fs.writeFile(bridgeInfoPath, JSON.stringify(bridgeInfo, null, 2), 'utf-8')

      // The extension is on disk by this point, so the install has already
      // succeeded. The clipboard copy is a convenience; failing the whole
      // install over it would undo a completed install, which the old
      // synchronous write could not do. Keep this catch: it is what makes a
      // clipboard failure non-fatal.
      try {
        await writeClipboardText(destPath)
      } catch (error) {
        Logger.warn('[NativeMessaging] Failed to copy install path to clipboard:', error)
      }

      return { success: true, installedPath: destPath, secret: sharedSecret }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  }

  static async remove(): Promise<{ success: boolean; error?: string }> {
    try {
      const bridgeInfoPath = this.resolveBridgeInfoPath()
      await fs.rm(bridgeInfoPath, { force: true })

      const secretPath = this.resolveSharedSecretPath()
      await fs.rm(secretPath, { force: true })

      const extPath = this.resolveInstalledExtensionPath()
      await fs.rm(extPath, { recursive: true, force: true })

      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  }
}

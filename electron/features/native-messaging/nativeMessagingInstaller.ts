import { execFile } from 'child_process'
import { app, clipboard } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { promisify } from 'util'

import { Logger } from '../../core/logger.js'
import { deriveExtensionIdFromKey } from './nativeMessagingOrigin.js'
import { EXTENSION_SOURCE_DIR, NATIVE_HOST_MANIFEST_NAME } from './nativeMessagingTypes.js'

const execFileAsync = promisify(execFile)
const NATIVE_HOST_REGISTRY_KEY = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_MANIFEST_NAME}`

function toForwardSlashPath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

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

  static async registerNativeHostInRegistry(manifestPath: string): Promise<void> {
    if (process.platform !== 'win32') return
    try {
      await execFileAsync('reg', ['add', NATIVE_HOST_REGISTRY_KEY, '/ve', '/d', manifestPath, '/f'])
    } catch (error) {
      Logger.warn('[NativeMessaging] Failed to register native host in registry:', error)
    }
  }

  static async unregisterNativeHostFromRegistry(): Promise<void> {
    if (process.platform !== 'win32') return
    try {
      await execFileAsync('reg', ['delete', NATIVE_HOST_REGISTRY_KEY, '/f'])
    } catch (error) {
      Logger.warn('[NativeMessaging] Failed to remove native host registry key:', error)
    }
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

  static async install(
    port: number,
    expectedExtensionOrigin: string | null
  ): Promise<{ success: boolean; error?: string; installedPath?: string }> {
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
        port,
        host: '127.0.0.1',
        endpoints: { cookies: '/api/cookies', health: '/api/health' }
      }
      await fs.mkdir(path.dirname(bridgeInfoPath), { recursive: true })
      await fs.writeFile(bridgeInfoPath, JSON.stringify(bridgeInfo, null, 2), 'utf-8')

      const nativeHostManifestPath = path.join(destPath, `${NATIVE_HOST_MANIFEST_NAME}.json`)
      const nativeHostManifest = {
        name: NATIVE_HOST_MANIFEST_NAME,
        description: 'Quizlab Reader native messaging host (HTTP bridge)',
        path: toForwardSlashPath(process.execPath),
        type: 'stdio',
        allowed_origins: expectedExtensionOrigin ? [`${expectedExtensionOrigin}/`] : []
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

  static async remove(): Promise<{ success: boolean; error?: string }> {
    try {
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
}

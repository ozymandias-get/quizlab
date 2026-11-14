import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

import { QUIZLAB_EXTENSION_ID } from '../../../shared/constants/extensionRelease.js'
import type { NativeMessagingExtensionInstallResult } from '../../../shared/types/native-messaging.js'
import { deriveExtensionIdFromKey } from './nativeMessagingOrigin.js'

/** The folder name of the extension inside the repository and the app. */
const EXTENSION_FOLDER = 'quizlab-session-extension'

/** The marker next to the installed copy: what the copy was made from. */
const INSTALL_MARKER = '.install.json'

/** The manifest format Chrome needs for an unpacked MV3 extension. */
const SUPPORTED_MANIFEST_VERSION = 3

/** Why the bundled extension could not be prepared. */
export type ExtensionInstallFailure = 'not_found' | 'invalid_manifest' | 'copy_failed'

export class ExtensionInstallError extends Error {
  readonly failure: ExtensionInstallFailure

  constructor(failure: ExtensionInstallFailure, message: string) {
    super(message)
    this.name = 'ExtensionInstallError'
    this.failure = failure
  }
}

/** The manifest fields the installer reads. */
interface ExtensionManifest {
  manifest_version?: unknown
  version?: unknown
  key?: unknown
  background?: { service_worker?: unknown }
  action?: { default_popup?: unknown }
  icons?: Record<string, unknown>
}

export interface ExtensionInstallerOptions {
  /** The folder that ships with the app (the repository in development). */
  sourceDirectory: string
  /** The stable, writable folder the user loads in Chrome. */
  targetDirectory: string
  /** The app version whose bundle is being installed. */
  appVersion: string
}

/**
 * Where the extension ships inside the running app.
 *
 * A packaged build copies `extensions/quizlab-session-extension` to
 * `resources/extension` (see the electron-builder `extraResources` entry).
 * `npm run dev:electron` reads the repository folder instead.
 */
function bundledExtensionSourceDirectory(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'extension')
    : path.join(app.getAppPath(), 'extensions', EXTENSION_FOLDER)
}

/**
 * Where the user loads the extension from.
 *
 * The folder lives in the per-user data directory: it is writable, its path
 * does not change on an app update, and it is not inside an installation
 * directory that may be read-only.
 */
function installedExtensionDirectory(): string {
  return path.join(app.getPath('userData'), 'extension', EXTENSION_FOLDER)
}

/**
 * Copies the bundled Chrome extension to a folder the user can load.
 *
 * Chrome only loads an unpacked extension when the user picks its folder in
 * `chrome://extensions`; the app cannot do that step for them. It can make sure
 * the folder exists at a stable path and tell the user where it is.
 *
 * The copy is refreshed when the app version or the manifest version changes,
 * so an app update does not leave Chrome on the old files. A marker written
 * after the copy records what the folder was built from; a crash in the middle
 * leaves no marker and the next attempt copies again.
 */
export class BundledExtensionInstaller {
  private readonly sourceDirectory: string
  private readonly targetDirectory: string
  private readonly appVersion: string

  constructor(options: Partial<ExtensionInstallerOptions> = {}) {
    this.sourceDirectory = options.sourceDirectory ?? bundledExtensionSourceDirectory()
    this.targetDirectory = options.targetDirectory ?? installedExtensionDirectory()
    this.appVersion = options.appVersion ?? app.getVersion()
  }

  /** The folder the user loads in Chrome. */
  get installedPath(): string {
    return this.targetDirectory
  }

  async install(): Promise<NativeMessagingExtensionInstallResult> {
    const manifest = await this.readManifest()
    // The bundle is checked before the installed copy is touched: a broken
    // source must not take away an extension Chrome is already loading.
    await this.assertLoadable(this.sourceDirectory, manifest, 'not_found')
    const version = manifest.version as string
    const targetParent = path.dirname(this.targetDirectory)
    const markerPath = path.join(targetParent, INSTALL_MARKER)

    const marker = await this.readMarker(markerPath)
    if (
      marker?.appVersion === this.appVersion &&
      marker.extensionVersion === version &&
      (await this.isLoadable(this.targetDirectory, manifest))
    ) {
      return { path: this.targetDirectory, version, refreshed: false }
    }

    try {
      await fs.mkdir(targetParent, { recursive: true })
      // The marker is removed first: a copy that stops half-way must not look
      // like a complete one.
      await fs.rm(markerPath, { force: true })
      await fs.rm(this.targetDirectory, { recursive: true, force: true })
      await fs.cp(this.sourceDirectory, this.targetDirectory, { recursive: true })
    } catch (error) {
      throw new ExtensionInstallError(
        'copy_failed',
        `The bundled extension could not be copied: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    await this.assertLoadable(this.targetDirectory, manifest)
    await fs.writeFile(
      markerPath,
      JSON.stringify({ appVersion: this.appVersion, extensionVersion: version }, null, 2),
      'utf-8'
    )
    return { path: this.targetDirectory, version, refreshed: true }
  }

  /**
   * Reads and checks the manifest of the bundle.
   *
   * The key is required: it pins the extension id the bridge's origin
   * allowlist accepts. An unpacked copy without it would load under another id
   * and could never pair.
   */
  private async readManifest(): Promise<ExtensionManifest> {
    const manifestPath = path.join(this.sourceDirectory, 'manifest.json')
    let raw: string
    try {
      raw = await fs.readFile(manifestPath, 'utf-8')
    } catch {
      throw new ExtensionInstallError(
        'not_found',
        `The bundled extension is missing at ${this.sourceDirectory}`
      )
    }

    let parsed: ExtensionManifest
    try {
      parsed = JSON.parse(raw) as ExtensionManifest
    } catch {
      throw new ExtensionInstallError('invalid_manifest', 'The extension manifest is not JSON')
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new ExtensionInstallError('invalid_manifest', 'The extension manifest is empty')
    }
    if (parsed.manifest_version !== SUPPORTED_MANIFEST_VERSION) {
      throw new ExtensionInstallError('invalid_manifest', 'The extension is not a Manifest V3 one')
    }
    if (typeof parsed.version !== 'string' || parsed.version.trim().length === 0) {
      throw new ExtensionInstallError('invalid_manifest', 'The extension has no version')
    }
    if (typeof parsed.key !== 'string' || parsed.key.length === 0) {
      throw new ExtensionInstallError('invalid_manifest', 'The extension has no pinned key')
    }
    // A changed key would make Chrome load the folder under another id, which
    // the bridge's origin allowlist rejects. Fail here instead of leaving the
    // user with an extension that can never connect.
    if (deriveExtensionIdFromKey(parsed.key) !== QUIZLAB_EXTENSION_ID) {
      throw new ExtensionInstallError(
        'invalid_manifest',
        'The extension key does not belong to this app'
      )
    }
    if (
      typeof parsed.background?.service_worker !== 'string' ||
      typeof parsed.action?.default_popup !== 'string' ||
      !parsed.icons ||
      typeof parsed.icons !== 'object'
    ) {
      throw new ExtensionInstallError('invalid_manifest', 'The extension manifest is incomplete')
    }
    return parsed
  }

  /** The files the manifest names, relative to the extension folder. */
  private manifestFiles(manifest: ExtensionManifest): string[] {
    const files = new Set<string>(['manifest.json', 'popup.js'])
    const worker = manifest.background?.service_worker
    const popup = manifest.action?.default_popup
    if (typeof worker === 'string') files.add(worker)
    if (typeof popup === 'string') files.add(popup)
    for (const icon of Object.values(manifest.icons ?? {})) {
      if (typeof icon === 'string') files.add(icon)
    }
    return [...files]
  }

  private async assertLoadable(
    directory: string,
    manifest: ExtensionManifest,
    failure: ExtensionInstallFailure = 'copy_failed'
  ): Promise<void> {
    for (const relative of this.manifestFiles(manifest)) {
      try {
        await fs.access(path.join(directory, relative))
      } catch {
        throw new ExtensionInstallError(
          failure,
          `The extension file "${relative}" is missing in ${directory}`
        )
      }
    }
  }

  private async isLoadable(directory: string, manifest: ExtensionManifest): Promise<boolean> {
    try {
      await this.assertLoadable(directory, manifest)
      return true
    } catch {
      return false
    }
  }

  private async readMarker(
    markerPath: string
  ): Promise<{ appVersion?: unknown; extensionVersion?: unknown } | null> {
    try {
      const raw = await fs.readFile(markerPath, 'utf-8')
      const parsed = JSON.parse(raw) as { appVersion?: unknown; extensionVersion?: unknown }
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
}

let sharedInstaller: BundledExtensionInstaller | null = null

/** The installer the app uses. */
export function getBundledExtensionInstaller(): BundledExtensionInstaller {
  sharedInstaller ??= new BundledExtensionInstaller()
  return sharedInstaller
}

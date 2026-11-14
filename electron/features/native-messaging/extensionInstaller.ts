import vm from 'node:vm'

import crypto from 'crypto'
import { app } from 'electron'
import type { Dirent } from 'fs'
import { promises as fs } from 'fs'
import path from 'path'

import { QUIZLAB_EXTENSION_ID } from '../../../shared/constants/extensionRelease.js'
import type { NativeMessagingExtensionInstallResult } from '../../../shared/types/native-messaging.js'
import { deriveExtensionIdFromKey } from './nativeMessagingOrigin.js'

/** The folder name of the extension inside the repository and the app. */
const EXTENSION_FOLDER = 'quizlab-session-extension'

/** The marker next to the installed copy: what the copy was made from. */
const INSTALL_MARKER = '.install.json'

/**
 * The folders used while the copy is swapped.
 *
 * They live next to the target so a rename stays on the same volume, and the
 * marker names in the parent are not inside the folder Chrome loads.
 */
const STAGING_FOLDER = '.install-staging'
const BACKUP_FOLDER = '.install-backup'

/** The manifest format Chrome needs for an unpacked MV3 extension. */
const SUPPORTED_MANIFEST_VERSION = 3

/** The file types that must be text, not binary garbage. */
const TEXT_EXTENSIONS = new Set(['.js', '.html', '.json', '.css'])

/** A JavaScript file above this size is not compiled for a syntax check. */
const MAX_SYNTAX_CHECK_BYTES = 2 * 1024 * 1024

/** How often a rename that Windows reports as locked is retried. */
const RENAME_ATTEMPTS = 3
const RENAME_RETRY_DELAY_MS = 75

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

/** What one inspected folder contains. */
interface InspectedBundle {
  manifest: ExtensionManifest
  version: string
  /** A deterministic hash over every file path and its content. */
  fingerprint: string
}

/** The marker written after a successful swap. */
interface InstallMarker {
  appVersion?: unknown
  extensionVersion?: unknown
  fingerprint?: unknown
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * A manifest path that stays inside the extension folder, or null.
 *
 * Chrome names every asset with a forward-slash path relative to the manifest.
 * An absolute path, a drive letter, a backslash or a `..` segment would let the
 * bundle point outside its own folder, so each is refused before any file is
 * read.
 */
function normalizeBundlePath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  if (raw.includes('\0') || raw.includes('\\')) return null
  if (path.posix.isAbsolute(raw) || /^[a-zA-Z]:/.test(raw)) return null
  const segments = raw.split('/')
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    return null
  }
  return segments.join('/')
}

/**
 * Copies the bundled Chrome extension to a folder the user can load.
 *
 * Chrome only loads an unpacked extension when the user picks its folder in
 * `chrome://extensions`; the app cannot do that step for them. It can make sure
 * the folder exists at a stable path and tell the user where it is.
 *
 * An update never deletes the working copy before the new one is complete:
 * the bundle is inspected, copied to a staging folder, inspected again, and
 * only then swapped in. The previous copy is kept as a backup until the swap
 * succeeded, and an interrupted swap is repaired by the next call.
 */
export class BundledExtensionInstaller {
  private readonly sourceDirectory: string
  private readonly targetDirectory: string
  private readonly appVersion: string
  /**
   * The install that is running.
   *
   * Two settings buttons or two windows can ask for the same install at once;
   * they share one operation, so neither can remove the staging or backup
   * folder of the other.
   */
  private installInFlight: Promise<NativeMessagingExtensionInstallResult> | null = null

  constructor(options: Partial<ExtensionInstallerOptions> = {}) {
    this.sourceDirectory = options.sourceDirectory ?? bundledExtensionSourceDirectory()
    this.targetDirectory = options.targetDirectory ?? installedExtensionDirectory()
    this.appVersion = options.appVersion ?? app.getVersion()
  }

  /** The folder the user loads in Chrome. */
  get installedPath(): string {
    return this.targetDirectory
  }

  install(): Promise<NativeMessagingExtensionInstallResult> {
    if (this.installInFlight) return this.installInFlight
    const run = this.performInstall().finally(() => {
      if (this.installInFlight === run) this.installInFlight = null
    })
    this.installInFlight = run
    return run
  }

  private async performInstall(): Promise<NativeMessagingExtensionInstallResult> {
    const source = await this.inspectBundle(this.sourceDirectory, 'not_found')
    const targetParent = path.dirname(this.targetDirectory)
    const markerPath = path.join(targetParent, INSTALL_MARKER)
    const stagingPath = path.join(targetParent, STAGING_FOLDER)
    const backupPath = path.join(targetParent, BACKUP_FOLDER)

    await this.recoverInterruptedInstall(stagingPath, backupPath)

    const marker = await this.readMarker(markerPath)
    const installed = await this.inspectInstalledCopy()
    // The content fingerprint is authoritative: an app update that does not
    // change the extension must not copy anything again, and a changed file
    // must refresh even when both version numbers stayed the same.
    if (
      marker.fingerprint === source.fingerprint &&
      installed?.fingerprint === source.fingerprint
    ) {
      if (marker.appVersion !== this.appVersion || marker.extensionVersion !== source.version) {
        // Keep the marker descriptive without touching the loaded folder.
        await this.writeMarker(markerPath, source)
      }
      await this.removeTree(backupPath)
      return { path: this.targetDirectory, version: source.version, refreshed: false }
    }

    await fs.mkdir(targetParent, { recursive: true })
    await this.removeTree(stagingPath)
    try {
      await fs.cp(this.sourceDirectory, stagingPath, { recursive: true })
    } catch (error) {
      await this.removeTree(stagingPath)
      throw new ExtensionInstallError(
        'copy_failed',
        `The bundled extension could not be staged: ${errorMessage(error)}`
      )
    }

    // The staging copy is validated as a whole before the working folder is
    // touched: a copy that lost a file or changed content never replaces it.
    let staged: InspectedBundle
    try {
      staged = await this.inspectBundle(stagingPath, 'copy_failed')
    } catch (error) {
      await this.removeTree(stagingPath)
      throw error
    }
    if (staged.fingerprint !== source.fingerprint) {
      await this.removeTree(stagingPath)
      throw new ExtensionInstallError(
        'copy_failed',
        'The staged extension does not match the bundled one'
      )
    }

    await this.commit(stagingPath, backupPath, markerPath, source)
    return { path: this.targetDirectory, version: source.version, refreshed: true }
  }

  /**
   * Moves the old copy aside and the new one in, and puts the old one back if
   * the new one cannot be moved.
   */
  private async commit(
    stagingPath: string,
    backupPath: string,
    markerPath: string,
    source: InspectedBundle
  ): Promise<void> {
    const hadTarget = await this.pathExists(this.targetDirectory)
    if (hadTarget) {
      // A stale backup from an earlier successful update is not a fallback for
      // this one; the current target is.
      await this.removeTree(backupPath)
      try {
        await this.renameWithRetry(this.targetDirectory, backupPath)
      } catch (error) {
        await this.removeTree(stagingPath)
        throw new ExtensionInstallError(
          'copy_failed',
          `The current extension could not be moved aside: ${errorMessage(error)}`
        )
      }
    }

    try {
      await this.renameWithRetry(stagingPath, this.targetDirectory)
    } catch (error) {
      // Put the working copy back. If even that fails, the backup stays where
      // it is and the next install restores it; the old files are not lost.
      const restoreError = hadTarget
        ? await this.restoreBackup(backupPath).catch((restoreFailure: unknown) => restoreFailure)
        : null
      await this.removeTree(stagingPath)
      throw new ExtensionInstallError(
        'copy_failed',
        restoreError
          ? `The new extension could not be moved in and the previous one could not be restored: ` +
              `${errorMessage(error)} / ${errorMessage(restoreError)}`
          : `The new extension could not be moved in: ${errorMessage(error)}`
      )
    }

    await this.writeMarker(markerPath, source)
    await this.removeTree(backupPath)
  }

  /** Writes the marker; a missing marker only means the next install refreshes. */
  private async writeMarker(markerPath: string, source: InspectedBundle): Promise<void> {
    try {
      await fs.writeFile(
        markerPath,
        JSON.stringify(
          {
            appVersion: this.appVersion,
            extensionVersion: source.version,
            fingerprint: source.fingerprint
          },
          null,
          2
        ),
        'utf-8'
      )
    } catch (error) {
      // The files are in place; a missing marker only means the next install
      // inspects and copies again. Losing the working extension for this would
      // be worse.
      console.warn('[ExtensionInstaller] The install marker could not be written:', error)
    }
  }

  /** Puts a backup back after a failed swap. */
  private async restoreBackup(backupPath: string): Promise<void> {
    if (!(await this.pathExists(backupPath))) return
    if (await this.pathExists(this.targetDirectory)) {
      await this.removeTree(this.targetDirectory)
    }
    await this.renameWithRetry(backupPath, this.targetDirectory)
  }

  /**
   * Repairs the state a crash can leave behind.
   *
   * A crash between `target -> backup` and `staging -> target` leaves no
   * target but a complete backup. The next call restores it before it does
   * anything else, so the extension Chrome loads never disappears.
   */
  private async recoverInterruptedInstall(stagingPath: string, backupPath: string): Promise<void> {
    await this.removeTree(stagingPath)
    if (!(await this.pathExists(this.targetDirectory)) && (await this.pathExists(backupPath))) {
      try {
        await this.renameWithRetry(backupPath, this.targetDirectory)
      } catch (error) {
        throw new ExtensionInstallError(
          'copy_failed',
          `The previous extension could not be restored from ${backupPath}: ${errorMessage(error)}`
        )
      }
    }
  }

  /** Renames a file/folder, retrying the locks Windows puts on directories. */
  private async renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 1; attempt <= RENAME_ATTEMPTS; attempt += 1) {
      try {
        await fs.rename(from, to)
        return
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        const retryable = code === 'EPERM' || code === 'EACCES' || code === 'EBUSY'
        if (!retryable || attempt === RENAME_ATTEMPTS) throw error
        await delay(RENAME_RETRY_DELAY_MS)
      }
    }
  }

  private async pathExists(target: string): Promise<boolean> {
    try {
      await fs.lstat(target)
      return true
    } catch {
      return false
    }
  }

  /** Removes a tree without following a symbolic link out of the parent. */
  private async removeTree(target: string): Promise<void> {
    try {
      const stat = await fs.lstat(target)
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        await fs.unlink(target)
        return
      }
    } catch {
      return
    }
    await fs.rm(target, { recursive: true, force: true }).catch(() => undefined)
  }

  /**
   * Reads, validates and fingerprints a folder.
   *
   * Every file is a regular file inside the folder: a symbolic link, a device
   * or a manifest path that escapes the root is refused. The fingerprint
   * covers the path and the bytes of every file, so a changed `background.js`
   * is detected even when the app and manifest versions are unchanged.
   */
  private async inspectBundle(
    directory: string,
    missingFailure: ExtensionInstallFailure
  ): Promise<InspectedBundle> {
    const manifest = await this.readManifest(directory, missingFailure)
    const files = await this.collectFiles(directory, missingFailure)

    for (const raw of this.manifestFiles(manifest)) {
      const normalized = normalizeBundlePath(raw)
      if (!normalized) {
        throw new ExtensionInstallError(
          'invalid_manifest',
          `The extension manifest names an unsafe path: ${String(raw)}`
        )
      }
      if (!files.has(normalized)) {
        throw new ExtensionInstallError(
          missingFailure,
          `The extension file "${normalized}" is missing in ${directory}`
        )
      }
    }

    const digest = crypto.createHash('sha256')
    for (const relative of [...files].sort()) {
      const fullPath = path.join(directory, ...relative.split('/'))
      let bytes: Buffer
      try {
        const stat = await fs.lstat(fullPath)
        if (!stat.isFile() || stat.isSymbolicLink()) {
          throw new Error('not a regular file')
        }
        bytes = await fs.readFile(fullPath)
      } catch (error) {
        throw new ExtensionInstallError(
          missingFailure,
          `The extension file "${relative}" could not be read: ${errorMessage(error)}`
        )
      }
      if (bytes.length === 0) {
        throw new ExtensionInstallError(
          'invalid_manifest',
          `The extension file "${relative}" is empty`
        )
      }
      const extension = path.posix.extname(relative).toLowerCase()
      if (TEXT_EXTENSIONS.has(extension) && bytes.includes(0)) {
        throw new ExtensionInstallError(
          'invalid_manifest',
          `The extension file "${relative}" is not text`
        )
      }
      if (extension === '.js' && bytes.length <= MAX_SYNTAX_CHECK_BYTES) {
        try {
          // Compiles the script without running it; a truncated copy or a
          // corrupted bundle fails here instead of inside Chrome.
          new vm.Script(bytes.toString('utf-8'), { filename: relative })
        } catch (error) {
          throw new ExtensionInstallError(
            'invalid_manifest',
            `The extension script "${relative}" is not valid JavaScript: ${errorMessage(error)}`
          )
        }
      }
      digest.update(relative)
      digest.update('\0')
      digest.update(String(bytes.length))
      digest.update('\0')
      digest.update(bytes)
    }

    return {
      manifest,
      version: manifest.version as string,
      fingerprint: digest.digest('hex')
    }
  }

  /** Every regular file below `directory`, as normalized relative paths. */
  private async collectFiles(
    directory: string,
    failure: ExtensionInstallFailure
  ): Promise<Set<string>> {
    const files = new Set<string>()
    const walk = async (current: string): Promise<void> => {
      let entries: Dirent[]
      try {
        entries = await fs.readdir(current, { withFileTypes: true })
      } catch (error) {
        throw new ExtensionInstallError(
          failure,
          `The extension folder "${current}" could not be read: ${errorMessage(error)}`
        )
      }
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name)
        if (entry.isSymbolicLink()) {
          throw new ExtensionInstallError(
            'invalid_manifest',
            `The extension contains a symbolic link: ${fullPath}`
          )
        }
        if (entry.isDirectory()) {
          await walk(fullPath)
          continue
        }
        if (!entry.isFile()) {
          throw new ExtensionInstallError(
            'invalid_manifest',
            `The extension contains an unsupported entry: ${fullPath}`
          )
        }
        files.add(path.relative(directory, fullPath).split(path.sep).join('/'))
      }
    }
    await walk(directory)
    return files
  }

  /**
   * Reads and checks the manifest of the bundle.
   *
   * The key is required: it pins the extension id the bridge's origin
   * allowlist accepts. An unpacked copy without it would load under another id
   * and could never pair.
   */
  private async readManifest(
    directory: string,
    missingFailure: ExtensionInstallFailure
  ): Promise<ExtensionManifest> {
    const manifestPath = path.join(directory, 'manifest.json')
    let raw: string
    try {
      raw = await fs.readFile(manifestPath, 'utf-8')
    } catch {
      throw new ExtensionInstallError(
        missingFailure,
        `The bundled extension is missing at ${directory}`
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

  /** The installed copy, or null when it is missing or not trustworthy. */
  private async inspectInstalledCopy(): Promise<InspectedBundle | null> {
    try {
      return await this.inspectBundle(this.targetDirectory, 'copy_failed')
    } catch {
      return null
    }
  }

  private async readMarker(markerPath: string): Promise<InstallMarker> {
    try {
      const raw = await fs.readFile(markerPath, 'utf-8')
      const parsed = JSON.parse(raw) as InstallMarker
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
}

let sharedInstaller: BundledExtensionInstaller | null = null

/** The installer the app uses. */
export function getBundledExtensionInstaller(): BundledExtensionInstaller {
  sharedInstaller ??= new BundledExtensionInstaller()
  return sharedInstaller
}

/**
 * The persisted state of the per-site session import.
 *
 * One entry per site holds three things: whether the site takes its session
 * from Chrome, when it was last imported and what the last import reported.
 * `configVersion` is the counter the Chrome extension polls: it advances only
 * when a switch really changes, so the extension pushes cookies when the user
 * asked for it and not on every tick.
 *
 * Two rules hold the file together:
 *
 *   - Every mutation goes through `ConfigManager.update(...)`, which writes the
 *     *whole* state. A write that carried only the changed site would drop
 *     every other site — the migrated Google switch would silently fall back
 *     to "off" the moment the user switched another site on.
 *   - `read()` never writes once the file exists. A version that advanced on
 *     every read would look like a change to the extension on every poll.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

import { ConfigManager } from '../../core/ConfigManager.js'
import { Logger } from '../../core/logger.js'

/** The file this feature writes its state into. */
const CONFIG_FILE_NAME = 'site-sessions.json'

/** The file the old Google-only feature wrote its state into. */
const LEGACY_CONFIG_FILE_NAME = 'gemini-web-session.json'

/** The site id of the Google group: the one row the legacy file maps onto. */
const GOOGLE_SITE_ID = 'google'

/** The state version this build writes and understands. */
const CONFIG_VERSION = 1

/** The keys a config file may not carry, mirroring `ConfigManager`'s guard. */
const PROHIBITED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export interface SiteSessionTargetState {
  enabled: boolean
  importedAt: string | null
  /** En erken süreli çerezin bitiş zamanı (ISO) — yalnızca bilgi amaçlı. */
  expiresAt: string | null
  lastResult: 'imported' | 'no_cookies' | 'permission_missing' | 'failed' | null
  lastError: string | null
}

export interface SiteSessionConfigFile {
  version: 1
  configVersion: number
  targets: Record<string, SiteSessionTargetState>
}

/** The file the per-site import state lives in. */
export function getSiteSessionConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE_NAME)
}

/**
 * The Google switch the legacy profile asked for, if it asked for one.
 *
 * The old feature had a single global switch. It becomes the switch of the
 * one Google row, so a profile that had the feature on keeps working. A
 * legacy file without a usable `enabled` says nothing: the answer is
 * `undefined` and every switch starts off.
 */
export function migrateLegacyGoogleEnabled(legacy: unknown): boolean | undefined {
  if (typeof legacy !== 'object' || legacy === null) return undefined
  const enabled = (legacy as { enabled?: unknown }).enabled
  return typeof enabled === 'boolean' ? enabled : undefined
}

/** The last results an import can report. */
const LAST_RESULTS: ReadonlySet<string> = new Set([
  'imported',
  'no_cookies',
  'permission_missing',
  'failed'
])

function isLastResult(value: unknown): value is SiteSessionTargetState['lastResult'] {
  return typeof value === 'string' && LAST_RESULTS.has(value)
}

/** A target that was never touched: off, never imported, no error. */
function createTargetState(enabled: boolean): SiteSessionTargetState {
  return {
    enabled,
    importedAt: null,
    expiresAt: null,
    lastResult: null,
    lastError: null
  }
}

/**
 * One target's state, read from a file that may have been edited by hand.
 *
 * Every value is checked before it reaches the caller: a corrupt file must
 * not be able to put the app into a state the rest of the feature cannot
 * describe.
 */
function normalizeTargetState(raw: unknown): SiteSessionTargetState {
  const source = (
    typeof raw === 'object' && raw !== null ? raw : {}
  ) as Partial<SiteSessionTargetState>
  return {
    enabled: source.enabled === true,
    importedAt: typeof source.importedAt === 'string' ? source.importedAt : null,
    expiresAt: typeof source.expiresAt === 'string' ? source.expiresAt : null,
    lastResult: isLastResult(source.lastResult) ? source.lastResult : null,
    lastError: typeof source.lastError === 'string' ? source.lastError : null
  }
}

/** The whole file, normalized. An empty or missing file is an empty state. */
function normalizeConfigFile(raw: unknown): SiteSessionConfigFile {
  const source = (
    typeof raw === 'object' && raw !== null ? raw : {}
  ) as Partial<SiteSessionConfigFile>
  const targets: Record<string, SiteSessionTargetState> = {}

  const rawTargets = source.targets
  if (typeof rawTargets === 'object' && rawTargets !== null) {
    for (const [siteId, state] of Object.entries(rawTargets)) {
      if (PROHIBITED_KEYS.has(siteId)) continue
      targets[siteId] = normalizeTargetState(state)
    }
  }

  const configVersion = source.configVersion
  return {
    version: CONFIG_VERSION,
    configVersion:
      typeof configVersion === 'number' && Number.isFinite(configVersion) ? configVersion : 0,
    targets
  }
}

/**
 * The state a fresh profile starts with.
 *
 * Every switch is off. The one exception is the migration: a legacy profile
 * that had the Google feature on keeps it on.
 */
function buildInitialState(legacyEnabled: boolean | undefined): SiteSessionConfigFile {
  const targets: Record<string, SiteSessionTargetState> = {}
  if (legacyEnabled === true) {
    targets[GOOGLE_SITE_ID] = createTargetState(true)
  }
  return { version: CONFIG_VERSION, configVersion: 0, targets }
}

export class SiteSessionConfig {
  private readonly configuredPath: string | null
  private resolvedPath: string | null = null
  private manager: ConfigManager<SiteSessionConfigFile> | null = null

  /**
   * @param filePath The file to use. Defaults to the user data folder, which
   *   is resolved on first use — `app.getPath()` is only safe once Electron
   *   is ready.
   */
  constructor(filePath?: string) {
    this.configuredPath = filePath ?? null
  }

  /** The file this instance reads and writes. */
  private get filePath(): string {
    this.resolvedPath ??= this.configuredPath ?? getSiteSessionConfigPath()
    return this.resolvedPath
  }

  /** The legacy file, which lives next to the current one. */
  private get legacyFilePath(): string {
    return path.join(path.dirname(this.filePath), LEGACY_CONFIG_FILE_NAME)
  }

  private get store(): ConfigManager<SiteSessionConfigFile> {
    this.manager ??= new ConfigManager<SiteSessionConfigFile>(this.filePath)
    return this.manager
  }

  /** Whether the state file exists. */
  private async fileExists(): Promise<boolean> {
    try {
      await fs.access(this.filePath)
      return true
    } catch {
      return false
    }
  }

  /** The legacy state, or undefined when there is none to read. */
  private async readLegacyState(): Promise<unknown> {
    try {
      const content = await fs.readFile(this.legacyFilePath, 'utf8')
      return JSON.parse(content) as unknown
    } catch {
      // No legacy file, or one that cannot be parsed: the migration has
      // nothing to carry over.
      return undefined
    }
  }

  /**
   * The merged state, with the migration applied.
   *
   * The migration runs before the first read: `ConfigManager.ensureFile()`
   * creates the file with `{}` when it is missing, so the question "is there
   * a new file yet" has to be asked with `fs.access` directly. Once the file
   * exists this only reads it.
   */
  private async loadState(): Promise<SiteSessionConfigFile> {
    if (await this.fileExists()) {
      return normalizeConfigFile(await this.store.read())
    }

    const initial = buildInitialState(migrateLegacyGoogleEnabled(await this.readLegacyState()))
    await this.store.write(initial)
    return initial
  }

  /** The whole state: the switches, the import history and the version. */
  async read(): Promise<SiteSessionConfigFile> {
    return this.loadState()
  }

  /** Whether the site takes its session from Chrome. */
  async isEnabled(siteId: string): Promise<boolean> {
    const state = await this.loadState()
    return state.targets[siteId]?.enabled === true
  }

  /**
   * Turns a site's switch on or off.
   *
   * The whole state is written, not only the site that changed, and the
   * version advances only when the switch really changed: the extension reads
   * the version to learn that the list of sites it should push for changed.
   */
  async setEnabled(siteId: string, enabled: boolean): Promise<SiteSessionConfigFile> {
    await this.loadState()

    const written = await this.store.update((current) => {
      const state = normalizeConfigFile(current)
      const existing = state.targets[siteId] ?? createTargetState(false)
      return {
        version: CONFIG_VERSION,
        configVersion: existing.enabled === enabled ? state.configVersion : state.configVersion + 1,
        targets: {
          ...state.targets,
          [siteId]: { ...existing, enabled }
        }
      }
    })

    if (!written) {
      Logger.error(`[Web Session] The switch of "${siteId}" could not be written.`)
    }

    return this.loadState()
  }

  /**
   * Records what the last import of a site reported.
   *
   * The switch itself does not change, so the version stays: the extension
   * has nothing new to push.
   */
  async recordResult(
    siteId: string,
    result: SiteSessionTargetState['lastResult'],
    error?: string
  ): Promise<void> {
    await this.loadState()

    const written = await this.store.update((current) => {
      const state = normalizeConfigFile(current)
      const existing = state.targets[siteId] ?? createTargetState(false)
      return {
        version: CONFIG_VERSION,
        configVersion: state.configVersion,
        targets: {
          ...state.targets,
          [siteId]: {
            ...existing,
            importedAt: result === 'imported' ? new Date().toISOString() : existing.importedAt,
            lastResult: result,
            lastError: error ?? null
          }
        }
      }
    })

    if (!written) {
      Logger.error(`[Web Session] The import result of "${siteId}" could not be written.`)
    }
  }

  /** The counter the extension polls to learn that something changed. */
  async getConfigVersion(): Promise<number> {
    const state = await this.loadState()
    return state.configVersion
  }
}

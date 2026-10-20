/**
 * The persisted state of the per-site session import.
 *
 * One entry per site holds three things: whether the site takes its session
 * from Chrome, when it was last imported and what the last import reported.
 * `configVersion` is the counter the Chrome extension polls: it advances only
 * when a switch really changes, so the extension pushes cookies when the user
 * asked for it and not on every tick.
 *
 * Three rules hold the file together:
 *
 *   - Every mutation goes through `ConfigManager.update(...)`, which writes the
 *     *whole* state. A write that carried only the changed site would drop
 *     every other site — the migrated Google switch would silently fall back
 *     to "off" the moment the user switched another site on.
 *   - The migration merges into whatever the file holds at that moment; it
 *     never replaces the file with a state built from scratch. A replacement
 *     would drop a switch that was set while the legacy file was being read.
 *   - `read()` never writes once the file exists. A version that advanced on
 *     every read would look like a change to the extension on every poll.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

import { GOOGLE_AI_WEB_SITE_ID } from '../../../shared/constants/googleAiWebApps.js'
import { ConfigManager } from '../../core/ConfigManager.js'

/** The file this feature writes its state into. */
const CONFIG_FILE_NAME = 'site-sessions.json'

/** The file the old Google-only feature wrote its state into. */
const LEGACY_CONFIG_FILE_NAME = 'gemini-web-session.json'

/** The state version this build writes. */
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
  /**
   * The format version of the file.
   *
   * A number rather than the literal `1`: a file written by a newer build
   * keeps its version instead of being silently downgraded by this one.
   */
  version: number
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
 * The counter the extension polls.
 *
 * The counter is clamped, not zeroed: a file that holds `"3"` as a string
 * still counts as three, so the next write does not move it backwards.
 */
function normalizeConfigVersion(value: unknown): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

/**
 * The format version of a file.
 *
 * A newer version is kept: this build must not pretend it understands a
 * format it does not know. An older or broken one becomes this build's.
 */
function normalizeFormatVersion(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(parsed)) return CONFIG_VERSION
  return Math.max(CONFIG_VERSION, Math.floor(parsed))
}

/**
 * One target's state, read from a file that may have been edited by hand.
 *
 * Every value is checked before it reaches the caller: a corrupt file must
 * not be able to put the app into a state the rest of the feature cannot
 * describe. The fields this build does not know are kept, so a file written
 * by a newer build does not lose them on the next write.
 */
function normalizeTargetState(raw: unknown): SiteSessionTargetState {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    ...source,
    enabled: source.enabled === true,
    importedAt: typeof source.importedAt === 'string' ? source.importedAt : null,
    expiresAt: typeof source.expiresAt === 'string' ? source.expiresAt : null,
    lastResult: isLastResult(source.lastResult) ? source.lastResult : null,
    lastError: typeof source.lastError === 'string' ? source.lastError : null
  }
}

/** The whole file, normalized. An empty or missing file is an empty state. */
function normalizeConfigFile(raw: unknown): SiteSessionConfigFile {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const targets: Record<string, SiteSessionTargetState> = {}

  const rawTargets = source.targets
  if (typeof rawTargets === 'object' && rawTargets !== null) {
    for (const [siteId, state] of Object.entries(rawTargets)) {
      if (PROHIBITED_KEYS.has(siteId)) continue
      targets[siteId] = normalizeTargetState(state)
    }
  }

  return {
    ...source,
    version: normalizeFormatVersion(source.version),
    configVersion: normalizeConfigVersion(source.configVersion),
    targets
  }
}

/**
 * The migrated Google switch, merged into the state that is already there.
 *
 * The migration adds a switch; it never replaces the state. A state built
 * from scratch would drop every switch that was set while the legacy file
 * was being read, and would roll the version back.
 */
export function mergeLegacyGoogleState(
  state: SiteSessionConfigFile,
  legacyEnabled: boolean | undefined
): SiteSessionConfigFile {
  if (legacyEnabled !== true || state.targets[GOOGLE_AI_WEB_SITE_ID]) return state
  return {
    ...state,
    targets: {
      ...state.targets,
      [GOOGLE_AI_WEB_SITE_ID]: createTargetState(true)
    }
  }
}

/**
 * The persisted state of the per-site session import.
 *
 * One instance per file: the class keeps the state it read in memory, so two
 * instances over the same file write over each other. The app uses
 * `getSiteSessionConfig()`; the constructor stays open for tests.
 */
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
      // The file is read from disk, not from the store's cache: another
      // instance — or another program — may have written it since the last
      // read, and the cache would hide that.
      return normalizeConfigFile(await this.store.read(true))
    }

    return this.migrateLegacyState()
  }

  /**
   * The one-time migration: the legacy Google switch becomes the switch of
   * the Google site.
   *
   * The merge runs inside the store's queue and merges into whatever the
   * file holds at that moment. Writing a state built from scratch would
   * replace a switch that was set while the legacy file was being read, and
   * would roll the version back.
   */
  private async migrateLegacyState(): Promise<SiteSessionConfigFile> {
    const legacyEnabled = migrateLegacyGoogleEnabled(await this.readLegacyState())

    // The file may have appeared while the legacy file was being read: read
    // it from disk so the merge starts from what is really there.
    if (await this.fileExists()) {
      await this.store.read(true)
    }

    await this.store.update((current) =>
      mergeLegacyGoogleState(normalizeConfigFile(current), legacyEnabled)
    )

    return normalizeConfigFile(await this.store.read(true))
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
   *
   * @throws when the state could not be written. A switch that was not
   *   persisted must not be reported to the user as done.
   */
  async setEnabled(siteId: string, enabled: boolean): Promise<SiteSessionConfigFile> {
    const state = await this.loadState()
    if (PROHIBITED_KEYS.has(siteId)) {
      // A prohibited id never reaches the file; the read path drops it too.
      return state
    }

    const written = await this.store.update((current) => {
      const currentState = normalizeConfigFile(current)
      const existing = currentState.targets[siteId] ?? createTargetState(false)
      return {
        ...currentState,
        configVersion:
          existing.enabled === enabled
            ? currentState.configVersion
            : currentState.configVersion + 1,
        targets: {
          ...currentState.targets,
          [siteId]: { ...existing, enabled }
        }
      }
    })

    if (!written) {
      throw new Error(`[Web Session] The switch of "${siteId}" could not be written.`)
    }

    return this.loadState()
  }

  /**
   * Records what the last import of a site reported.
   *
   * The switch itself does not change, so the version stays: the extension
   * has nothing new to push.
   *
   * `expiresAt` is informational: it is the earliest expiry among the
   * imported cookies, so the settings row can say when the session the app
   * holds is likely to run out.
   *
   * @throws when the state could not be written.
   */
  async recordResult(
    siteId: string,
    result: SiteSessionTargetState['lastResult'],
    error?: string,
    expiresAt?: string | null
  ): Promise<void> {
    await this.loadState()
    if (PROHIBITED_KEYS.has(siteId)) return

    const written = await this.store.update((current) => {
      const currentState = normalizeConfigFile(current)
      const existing = currentState.targets[siteId] ?? createTargetState(false)
      return {
        ...currentState,
        configVersion: currentState.configVersion,
        targets: {
          ...currentState.targets,
          [siteId]: {
            ...existing,
            importedAt: result === 'imported' ? new Date().toISOString() : existing.importedAt,
            expiresAt: expiresAt === undefined ? existing.expiresAt : expiresAt,
            lastResult: result,
            lastError: error ?? null
          }
        }
      }
    })

    if (!written) {
      throw new Error(`[Web Session] The import result of "${siteId}" could not be written.`)
    }
  }

  /** The counter the extension polls to learn that something changed. */
  async getConfigVersion(): Promise<number> {
    const state = await this.loadState()
    return state.configVersion
  }
}

let sharedConfig: SiteSessionConfig | null = null

/**
 * The instance the app uses.
 *
 * The class keeps the file's state in memory, so two instances over the same
 * file write over each other. The app shares this one; the constructor stays
 * open for tests.
 */
export function getSiteSessionConfig(): SiteSessionConfig {
  sharedConfig ??= new SiteSessionConfig()
  return sharedConfig
}

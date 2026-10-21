/**
 * The persisted state of the per-site session import.
 *
 * One entry per site holds the accounts of that site: the name, whether it
 * takes its session from Chrome, when it was last imported, what the last
 * import reported and the fingerprints that tell the accounts apart. The
 * site also remembers its active account. `configVersion` is the counter the
 * Chrome extension polls: it advances only when a switch or the set of
 * accounts really changes, so the extension pushes on the user's request and
 * not on every tick.
 *
 * Three rules hold the file together:
 *
 *   - Every mutation goes through `ConfigManager.update(...)`, which writes
 *     the *whole* state. A write that carried only the changed account would
 *     drop every other account — the primary account would fall back to "off"
 *     the moment the user switched a second one on.
 *   - The migrations merge into whatever the file holds at that moment; they
 *     never replace it with a state built from scratch, which would drop a
 *     switch that was set while the legacy file was being read.
 *   - `read()` never writes once the file is in the new format: a version
 *     that advanced on every poll would look like a change to the extension.
 *     An old file is the exception — it is migrated once and written back.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

import { GOOGLE_AI_WEB_SITE_ID } from '../../../shared/constants/googleAiWebApps.js'
import { PRIMARY_ACCOUNT_ID } from '../../../shared/types/siteSession.js'
import { ConfigManager } from '../../core/ConfigManager.js'
import {
  isLastResult,
  migrateSiteSessionStateV1,
  normalizeConfigVersion,
  PROHIBITED_KEYS,
  type SiteSessionAccountState,
  type SiteSessionConfigFile,
  type SiteSessionSiteState
} from './siteSessionMigration.js'

/** The file this feature writes its state into. */
const CONFIG_FILE_NAME = 'site-sessions.json'

/** The file the old Google-only feature wrote its state into. */
const LEGACY_CONFIG_FILE_NAME = 'gemini-web-session.json'

/** The state version this build writes. */
const CONFIG_VERSION = 2

/** How many fingerprints an account keeps: the newest ones. */
const MAX_FINGERPRINTS = 5

/** Whether a value is an object whose fields may be read one by one. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

/** An account that was never touched: unnamed, off, no history. */
function createAccountState(enabled: boolean): SiteSessionAccountState {
  return {
    name: null,
    enabled,
    importedAt: null,
    lastResult: null,
    lastError: null,
    fingerprints: []
  }
}

/** A site that was never touched: no accounts and no active one. */
function createSiteState(): SiteSessionSiteState {
  return {
    accounts: {},
    activeAccountId: null
  }
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
 * The fingerprints of an account, newest last, capped at five: a token that
 * renews on every session refresh would otherwise grow the file forever.
 */
function normalizeFingerprints(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((entry): entry is string => typeof entry === 'string').slice(-MAX_FINGERPRINTS)
}

/** The account's history with one more fingerprint, capped at the newest five. */
function addFingerprint(history: readonly string[], fingerprint: string): string[] {
  return [...history, fingerprint].slice(-MAX_FINGERPRINTS)
}

/**
 * One account, read from a file that may have been edited by hand. Every
 * value is checked, and the fields this build does not know are kept so that
 * a newer build does not lose them on the next write.
 */
function normalizeAccountState(raw: unknown): SiteSessionAccountState {
  const source = isRecord(raw) ? raw : {}
  return {
    ...source,
    name: typeof source.name === 'string' ? source.name : null,
    enabled: source.enabled === true,
    importedAt: typeof source.importedAt === 'string' ? source.importedAt : null,
    lastResult: isLastResult(source.lastResult) ? source.lastResult : null,
    lastError: typeof source.lastError === 'string' ? source.lastError : null,
    fingerprints: normalizeFingerprints(source.fingerprints)
  }
}

/**
 * The active account of a site. A dangling id is repaired: the site has no
 * active account until one the site really holds is picked.
 */
function normalizeActiveAccountId(
  value: unknown,
  accounts: Record<string, SiteSessionAccountState>
): string | null {
  if (typeof value !== 'string') return null
  // `Object.hasOwn` keeps prototype-chain ids ('constructor', '__proto__', …)
  // from resolving to an inherited member of the accounts.
  return Object.hasOwn(accounts, value) ? value : null
}

/** One site with its accounts, read from a file that may have been edited by hand. */
function normalizeSiteState(raw: unknown): SiteSessionSiteState {
  const source = isRecord(raw) ? raw : {}
  const accounts: Record<string, SiteSessionAccountState> = {}

  if (isRecord(source.accounts)) {
    for (const [accountId, account] of Object.entries(source.accounts)) {
      if (PROHIBITED_KEYS.has(accountId)) continue
      accounts[accountId] = normalizeAccountState(account)
    }
  }

  return {
    ...source,
    accounts,
    activeAccountId: normalizeActiveAccountId(source.activeAccountId, accounts)
  }
}

/** The whole file, normalized. An empty or missing file is an empty state. */
function normalizeConfigFile(raw: unknown): SiteSessionConfigFile {
  const source = isRecord(raw) ? raw : {}
  const sites: Record<string, SiteSessionSiteState> = {}

  if (isRecord(source.sites)) {
    for (const [siteId, site] of Object.entries(source.sites)) {
      if (PROHIBITED_KEYS.has(siteId)) continue
      sites[siteId] = normalizeSiteState(site)
    }
  }

  // The old `targets` dictionary is not part of the new shape: a file that
  // still carries it must not keep it alive on the next write.
  const normalized: Record<string, unknown> = { ...source }
  delete normalized.targets

  return {
    ...normalized,
    version: normalizeFormatVersion(source.version),
    configVersion: normalizeConfigVersion(source.configVersion),
    sites
  }
}

/**
 * Whether a file is in the old site-level shape. A numeric version decides;
 * a version that is not a number says nothing, so a non-empty `targets`
 * dictionary decides instead. This mirrors `migrateSiteSessionStateV1` and
 * only answers whether the migrated state has to be written back.
 */
function isOldFormatFile(raw: unknown): boolean {
  if (!isRecord(raw)) return true

  const version = raw.version
  if (typeof version === 'number' && Number.isFinite(version)) {
    return Math.floor(version) < CONFIG_VERSION
  }

  return isRecord(raw.targets) && Object.keys(raw.targets).length > 0
}

/**
 * An old file, migrated and normalized in one step. The fields this build
 * does not know are copied over the migrated state, and the old `targets`
 * dictionary is dropped on the way.
 */
function migrateConfigFile(raw: unknown): SiteSessionConfigFile {
  const source = isRecord(raw) ? raw : {}
  return normalizeConfigFile({ ...source, ...migrateSiteSessionStateV1(raw) })
}

/**
 * The migrated Google switch, merged into the state that is already there.
 *
 * The migration adds the primary account of the Google site; it never
 * replaces the state. A state built from scratch would drop every switch
 * that was set while the legacy file was being read, and would roll the
 * version back.
 */
export function mergeLegacyGoogleState(
  state: SiteSessionConfigFile,
  legacyEnabled: boolean | undefined
): SiteSessionConfigFile {
  if (legacyEnabled !== true || state.sites[GOOGLE_AI_WEB_SITE_ID]) return state
  return {
    ...state,
    sites: {
      ...state.sites,
      [GOOGLE_AI_WEB_SITE_ID]: {
        accounts: { [PRIMARY_ACCOUNT_ID]: createAccountState(true) },
        activeAccountId: PRIMARY_ACCOUNT_ID
      }
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
   * The state, with the migrations applied.
   *
   * `ConfigManager.ensureFile()` writes `{}` for a missing file, so existence
   * is checked with `fs.access` directly; an old file is migrated once.
   */
  private async loadState(): Promise<SiteSessionConfigFile> {
    if (!(await this.fileExists())) {
      return this.migrateLegacyState()
    }

    // Read from disk, not from the store's cache: another instance may have
    // written the file since the cache was filled.
    const raw = await this.store.read(true)
    if (!isOldFormatFile(raw)) return normalizeConfigFile(raw)

    // Migrate inside the store's queue so a switch set in between is kept.
    const written = await this.store.update((current) => migrateConfigFile(current))
    if (!written) {
      throw new Error('[Web Session] The old state file could not be migrated.')
    }

    return normalizeConfigFile(await this.store.read(true))
  }

  /**
   * The one-time migration of the legacy Google switch.
   *
   * The merge runs inside the store's queue, into whatever the file holds at
   * that moment, so a switch set meanwhile is neither replaced nor rolled
   * back.
   *
   * @throws when the state could not be written.
   */
  private async migrateLegacyState(): Promise<SiteSessionConfigFile> {
    const legacyEnabled = migrateLegacyGoogleEnabled(await this.readLegacyState())

    // The file may have appeared while the legacy file was being read: read
    // it from disk so the merge starts from what is really there.
    if (await this.fileExists()) {
      await this.store.read(true)
    }

    const written = await this.store.update((current) =>
      mergeLegacyGoogleState(migrateConfigFile(current), legacyEnabled)
    )

    if (!written) {
      throw new Error('[Web Session] The legacy state could not be migrated.')
    }

    return normalizeConfigFile(await this.store.read(true))
  }

  /** The whole state: the accounts, the switches and the version. */
  async read(): Promise<SiteSessionConfigFile> {
    return this.loadState()
  }

  /** Whether the account takes its session from Chrome. */
  async isEnabled(siteId: string, accountId: string): Promise<boolean> {
    const state = await this.loadState()
    return state.sites[siteId]?.accounts[accountId]?.enabled === true
  }

  /**
   * Turns the switch of one account on or off.
   *
   * A missing account is created off — the primary one when the caller names
   * the primary — and the switch is written on top. The version advances only
   * when the switch really changed: the extension reads it to learn that the
   * list of sites to push for changed.
   *
   * @throws when the state could not be written.
   */
  async setEnabled(
    siteId: string,
    accountId: string,
    enabled: boolean
  ): Promise<SiteSessionConfigFile> {
    const state = await this.loadState()
    if (PROHIBITED_KEYS.has(siteId) || PROHIBITED_KEYS.has(accountId)) {
      // A prohibited id never reaches the file; the read path drops it too.
      return state
    }

    const written = await this.store.update((current) => {
      const currentState = normalizeConfigFile(current)
      const site = currentState.sites[siteId] ?? createSiteState()
      const existing = site.accounts[accountId] ?? createAccountState(false)
      return {
        ...currentState,
        configVersion:
          existing.enabled === enabled
            ? currentState.configVersion
            : currentState.configVersion + 1,
        sites: {
          ...currentState.sites,
          [siteId]: {
            ...site,
            accounts: {
              ...site.accounts,
              [accountId]: { ...existing, enabled }
            }
          }
        }
      }
    })

    if (!written) {
      throw new Error(`[Web Session] The switch of "${siteId}" could not be written.`)
    }

    return this.loadState()
  }

  /**
   * Records what the last import of one account reported. The version stays:
   * the extension has nothing new to push.
   *
   * @throws when the state could not be written.
   */
  async recordResult(
    siteId: string,
    accountId: string,
    result: SiteSessionAccountState['lastResult'],
    error?: string
  ): Promise<void> {
    await this.loadState()
    if (PROHIBITED_KEYS.has(siteId) || PROHIBITED_KEYS.has(accountId)) return

    const written = await this.store.update((current) => {
      const currentState = normalizeConfigFile(current)
      const site = currentState.sites[siteId] ?? createSiteState()
      const existing = site.accounts[accountId] ?? createAccountState(false)
      return {
        ...currentState,
        sites: {
          ...currentState.sites,
          [siteId]: {
            ...site,
            accounts: {
              ...site.accounts,
              [accountId]: {
                ...existing,
                importedAt: result === 'imported' ? new Date().toISOString() : existing.importedAt,
                lastResult: result,
                lastError: error ?? null
              }
            }
          }
        }
      }
    })

    if (!written) {
      throw new Error(`[Web Session] The import result of "${siteId}" could not be written.`)
    }
  }

  /**
   * Adds an account the bridge found in Chrome.
   *
   * The account is open from the start: the session that opened it came from
   * Chrome. When the same account id is written again, its fingerprint
   * history is carried over and capped at the newest five entries.
   *
   * The version advances: the extension pushes a session for a new account,
   * and the settings list has to show it.
   *
   * @throws when the state could not be written.
   */
  async createAccount(
    siteId: string,
    accountId: string,
    fingerprint: string | null
  ): Promise<void> {
    await this.loadState()
    if (PROHIBITED_KEYS.has(siteId) || PROHIBITED_KEYS.has(accountId)) return

    const written = await this.store.update((current) => {
      const currentState = normalizeConfigFile(current)
      const site = currentState.sites[siteId] ?? createSiteState()
      const existing = site.accounts[accountId]
      return {
        ...currentState,
        configVersion: currentState.configVersion + 1,
        sites: {
          ...currentState.sites,
          [siteId]: {
            ...site,
            accounts: {
              ...site.accounts,
              [accountId]: {
                name: null,
                enabled: true,
                importedAt: null,
                lastResult: null,
                lastError: null,
                fingerprints: fingerprint
                  ? addFingerprint(existing?.fingerprints ?? [], fingerprint)
                  : []
              }
            }
          }
        }
      }
    })

    if (!written) {
      throw new Error(
        `[Web Session] The account "${accountId}" of "${siteId}" could not be written.`
      )
    }
  }

  /**
   * Gives an account the user's name for it. An empty name means "no name";
   * the settings list falls back to the position of the account. The version
   * stays — the extension does not know about names.
   *
   * @throws when the state could not be written.
   */
  async renameAccount(siteId: string, accountId: string, name: string): Promise<void> {
    await this.loadState()
    if (PROHIBITED_KEYS.has(siteId) || PROHIBITED_KEYS.has(accountId)) return

    const written = await this.store.update((current) => {
      const currentState = normalizeConfigFile(current)
      const site = currentState.sites[siteId]
      const existing = site?.accounts[accountId]
      if (!site || !existing) return currentState

      return {
        ...currentState,
        sites: {
          ...currentState.sites,
          [siteId]: {
            ...site,
            accounts: {
              ...site.accounts,
              [accountId]: { ...existing, name: name === '' ? null : name }
            }
          }
        }
      }
    })

    if (!written) {
      throw new Error(`[Web Session] The name of "${accountId}" could not be written.`)
    }
  }

  /**
   * Removes an additional account of a site.
   *
   * The primary account cannot be deleted: it holds the platform's own
   * partition and the login the user typed there by hand. Its switch is the
   * way to empty it.
   *
   * The version advances, and a site that loses its last account is removed
   * with it.
   *
   * @throws when the account is the primary one, or when the state could not
   *   be written.
   */
  async deleteAccount(siteId: string, accountId: string): Promise<void> {
    if (accountId === PRIMARY_ACCOUNT_ID) {
      throw new Error('primary account cannot be deleted')
    }

    await this.loadState()
    if (PROHIBITED_KEYS.has(siteId) || PROHIBITED_KEYS.has(accountId)) return

    const written = await this.store.update((current) => {
      const currentState = normalizeConfigFile(current)
      const site = currentState.sites[siteId]
      if (!site || !Object.hasOwn(site.accounts, accountId)) return currentState

      const accounts = { ...site.accounts }
      delete accounts[accountId]

      const sites = { ...currentState.sites }
      if (Object.keys(accounts).length === 0) {
        delete sites[siteId]
      } else {
        sites[siteId] = {
          ...site,
          accounts,
          activeAccountId: site.activeAccountId === accountId ? null : site.activeAccountId
        }
      }

      return {
        ...currentState,
        configVersion: currentState.configVersion + 1,
        sites
      }
    })

    if (!written) {
      throw new Error(`[Web Session] The account "${accountId}" could not be removed.`)
    }
  }

  /**
   * Marks the account the panels of the site open with. The extension does
   * not know about accounts, so the version stays; only the user changes it.
   *
   * @throws when the state could not be written.
   */
  async setActiveAccount(siteId: string, accountId: string): Promise<void> {
    await this.loadState()
    if (PROHIBITED_KEYS.has(siteId) || PROHIBITED_KEYS.has(accountId)) return

    const written = await this.store.update((current) => {
      const currentState = normalizeConfigFile(current)
      const site = currentState.sites[siteId] ?? createSiteState()
      return {
        ...currentState,
        sites: {
          ...currentState.sites,
          [siteId]: { ...site, activeAccountId: accountId }
        }
      }
    })

    if (!written) {
      throw new Error(`[Web Session] The active account of "${siteId}" could not be written.`)
    }
  }

  /**
   * Removes the state of a site that does not exist any more, with every
   * account it held.
   *
   * A user-added site the user deleted leaves an entry behind otherwise, and
   * an entry that says "switched on" for a site that is gone would keep the
   * extension pushing a site the app does not know.
   *
   * The version advances: the extension polls it, and a site that is gone has
   * to leave the list it polls.
   *
   * @throws when the state could not be written.
   */
  async forget(siteId: string): Promise<void> {
    await this.loadState()
    if (PROHIBITED_KEYS.has(siteId)) return

    const written = await this.store.update((current) => {
      const currentState = normalizeConfigFile(current)
      if (!currentState.sites[siteId]) return currentState

      const sites = { ...currentState.sites }
      delete sites[siteId]
      return {
        ...currentState,
        configVersion: currentState.configVersion + 1,
        sites
      }
    })

    if (!written) {
      throw new Error(`[Web Session] The state of "${siteId}" could not be removed.`)
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

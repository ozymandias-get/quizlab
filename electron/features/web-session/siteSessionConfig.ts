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
  addFingerprint,
  isMigratedFile,
  PROHIBITED_KEYS,
  readConfigFile,
  type SiteSessionAccountState,
  type SiteSessionConfigFile,
  type SiteSessionSiteState
} from './siteSessionMigration.js'

/** The file this feature writes its state into. */
const CONFIG_FILE_NAME = 'site-sessions.json'

/** The file the old Google-only feature wrote its state into. */
const LEGACY_CONFIG_FILE_NAME = 'gemini-web-session.json'

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
    if (isMigratedFile(raw)) return readConfigFile(raw)

    // Migrate inside the store's queue so a switch set in between is kept.
    const written = await this.store.update((current) => readConfigFile(current))
    if (!written) {
      throw new Error('[Web Session] The old state file could not be migrated.')
    }

    return readConfigFile(await this.store.read(true))
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

    // The state is migrated first and the legacy switch is merged into the
    // result. The brief names the merge first; this order is deliberate: only
    // a missing state file reaches this path, and the merge only adds Google
    // when the site is absent, so neither step can replace the other.
    const written = await this.store.update((current) =>
      mergeLegacyGoogleState(readConfigFile(current), legacyEnabled)
    )

    if (!written) {
      throw new Error('[Web Session] The legacy state could not be migrated.')
    }

    return readConfigFile(await this.store.read(true))
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
      const currentState = readConfigFile(current)
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
      const currentState = readConfigFile(current)
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
   * A new account is open from the start: the session that opened it came
   * from Chrome. An account id that is already in the file is never reset:
   * its name, switch, import history and unknown fields stay, and only a
   * fingerprint that is not in its history is added. The version advances
   * only for a genuinely new account — the extension pushes a session for it
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
      const currentState = readConfigFile(current)
      const site = currentState.sites[siteId] ?? createSiteState()
      const existing = site.accounts[accountId]

      if (existing) {
        if (!fingerprint || existing.fingerprints.includes(fingerprint)) return currentState
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
                  fingerprints: addFingerprint(existing.fingerprints, fingerprint)
                }
              }
            }
          }
        }
      }

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
                fingerprints: fingerprint ? [fingerprint] : []
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
      const currentState = readConfigFile(current)
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
      const currentState = readConfigFile(current)
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
   * Marks the account the panels of the site open with. The account has to be
   * one the site holds; an unknown id leaves the state alone, so the write
   * path cannot produce a dangling reference its own reader would repair. The
   * extension does not know about accounts, so the version stays; only the
   * user changes it.
   *
   * @throws when the state could not be written.
   */
  async setActiveAccount(siteId: string, accountId: string): Promise<void> {
    await this.loadState()
    if (PROHIBITED_KEYS.has(siteId) || PROHIBITED_KEYS.has(accountId)) return

    const written = await this.store.update((current) => {
      const currentState = readConfigFile(current)
      const site = currentState.sites[siteId]
      if (!site || !Object.hasOwn(site.accounts, accountId)) return currentState

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
      const currentState = readConfigFile(current)
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

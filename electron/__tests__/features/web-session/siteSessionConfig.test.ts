import {
  mkdirSync,
  mkdtempSync,
  promises as fs,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SiteSessionConfig,
  getSiteSessionConfig,
  getSiteSessionConfigPath,
  mergeLegacyGoogleState,
  migrateLegacyGoogleEnabled
} from '../../../features/web-session/siteSessionConfig.js'
import type {
  SiteSessionAccountState,
  SiteSessionConfigFile
} from '../../../features/web-session/siteSessionMigration.js'
import { deriveSiteSessionStatus } from '../../../features/web-session/siteSessionStatus.js'
import { PRIMARY_ACCOUNT_ID } from '../../../../shared/types/siteSession.js'

/** The user data folder the app keeps its state in. */
const USER_DATA = path.join(os.tmpdir(), 'quizlab-user-data')

vi.mock('electron', () => ({
  app: {
    getPath: () => USER_DATA
  }
}))

/** An account that was never touched: named by its position, off, no history. */
function account(overrides: Partial<SiteSessionAccountState> = {}): SiteSessionAccountState {
  return {
    name: null,
    enabled: false,
    importedAt: null,
    lastResult: null,
    lastError: null,
    fingerprints: [],
    ...overrides
  }
}

describe('site session status', () => {
  it('reports a signed out site when the import is off and no local session exists', () => {
    expect(
      deriveSiteSessionStatus({
        enabled: false,
        extensionConnected: true,
        extensionVersionOk: true,
        lastResult: null,
        hasLocalSession: false
      })
    ).toBe('signed_out')
  })

  it('reports a manual session when the import is off but a local session exists', () => {
    expect(
      deriveSiteSessionStatus({
        enabled: false,
        extensionConnected: true,
        extensionVersionOk: true,
        lastResult: null,
        hasLocalSession: true
      })
    ).toBe('manual_session')
  })

  it('reports a missing extension before anything else', () => {
    expect(
      deriveSiteSessionStatus({
        enabled: true,
        extensionConnected: false,
        extensionVersionOk: true,
        lastResult: null,
        hasLocalSession: false
      })
    ).toBe('extension_missing')
  })

  it('reports an outdated extension instead of an empty browser session', () => {
    expect(
      deriveSiteSessionStatus({
        enabled: true,
        extensionConnected: true,
        extensionVersionOk: false,
        lastResult: 'no_cookies',
        hasLocalSession: false
      })
    ).toBe('extension_outdated')
  })

  it('reports a missing permission when the extension could not read the site', () => {
    expect(
      deriveSiteSessionStatus({
        enabled: true,
        extensionConnected: true,
        extensionVersionOk: true,
        lastResult: 'permission_missing',
        hasLocalSession: false
      })
    ).toBe('permission_missing')
  })

  it('reports an empty browser session without claiming a signed out site', () => {
    expect(
      deriveSiteSessionStatus({
        enabled: true,
        extensionConnected: true,
        extensionVersionOk: true,
        lastResult: 'no_cookies',
        hasLocalSession: true
      })
    ).toBe('no_cookies_in_browser')
  })

  it('reports a failed import and an import that has not happened yet', () => {
    expect(
      deriveSiteSessionStatus({
        enabled: true,
        extensionConnected: true,
        extensionVersionOk: true,
        lastResult: 'failed',
        hasLocalSession: false
      })
    ).toBe('import_failed')
    expect(
      deriveSiteSessionStatus({
        enabled: true,
        extensionConnected: true,
        extensionVersionOk: true,
        lastResult: null,
        hasLocalSession: false
      })
    ).toBe('extension_connected')
  })
})

describe('legacy google migration', () => {
  it('keeps an explicitly enabled legacy profile enabled', () => {
    expect(migrateLegacyGoogleEnabled({ enabled: true })).toBe(true)
  })

  it('keeps an explicitly disabled legacy profile disabled', () => {
    expect(migrateLegacyGoogleEnabled({ enabled: false })).toBe(false)
  })

  it('returns undefined when there is no legacy file', () => {
    expect(migrateLegacyGoogleEnabled(undefined)).toBeUndefined()
  })

  it('returns undefined for a legacy file without a usable switch', () => {
    expect(migrateLegacyGoogleEnabled(null)).toBeUndefined()
    expect(migrateLegacyGoogleEnabled({})).toBeUndefined()
    expect(migrateLegacyGoogleEnabled({ enabled: 'yes' })).toBeUndefined()
    expect(migrateLegacyGoogleEnabled('enabled')).toBeUndefined()
  })
})

describe('legacy google merge', () => {
  const stateWithChatgpt: SiteSessionConfigFile = {
    version: 2,
    configVersion: 1,
    sites: {
      chatgpt: {
        accounts: { [PRIMARY_ACCOUNT_ID]: account({ enabled: true }) },
        activeAccountId: PRIMARY_ACCOUNT_ID
      }
    }
  }

  it('adds the migrated switch to the state that is already there', () => {
    const merged = mergeLegacyGoogleState(stateWithChatgpt, true)

    expect(merged.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(merged.sites.google.activeAccountId).toBe(PRIMARY_ACCOUNT_ID)
    expect(merged.sites.chatgpt.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(merged.configVersion).toBe(1)
  })

  it('leaves a state that already has a Google switch alone', () => {
    const state: SiteSessionConfigFile = {
      ...stateWithChatgpt,
      sites: {
        ...stateWithChatgpt.sites,
        google: {
          accounts: { [PRIMARY_ACCOUNT_ID]: account() },
          activeAccountId: PRIMARY_ACCOUNT_ID
        }
      }
    }

    const merged = mergeLegacyGoogleState(state, true)

    // The user turned the Google switch off in the new app; the legacy file
    // may not turn it back on.
    expect(merged.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(false)
  })

  it('leaves the state alone when the legacy profile had no switch', () => {
    expect(mergeLegacyGoogleState(stateWithChatgpt, undefined)).toEqual(stateWithChatgpt)
    expect(mergeLegacyGoogleState(stateWithChatgpt, false)).toEqual(stateWithChatgpt)
  })
})

describe('site session config', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'site-session-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  function configPath(): string {
    return path.join(tempDir, 'site-sessions.json')
  }

  function writeLegacy(contents: unknown): void {
    writeFileSync(path.join(tempDir, 'gemini-web-session.json'), JSON.stringify(contents), 'utf8')
  }

  function writeRawConfig(contents: unknown): void {
    writeFileSync(configPath(), JSON.stringify(contents), 'utf8')
  }

  function readRawConfig(): SiteSessionConfigFile {
    return JSON.parse(readFileSync(configPath(), 'utf8'))
  }

  it('keeps the state file in the user data folder', () => {
    expect(getSiteSessionConfigPath()).toBe(path.join(USER_DATA, 'site-sessions.json'))
  })

  it('shares one instance for the app', () => {
    expect(getSiteSessionConfig()).toBe(getSiteSessionConfig())
  })

  it('starts every switch off on a fresh profile', async () => {
    const config = new SiteSessionConfig(configPath())

    expect(await config.isEnabled('google', PRIMARY_ACCOUNT_ID)).toBe(false)
    expect(await config.isEnabled('chatgpt', PRIMARY_ACCOUNT_ID)).toBe(false)

    const state = await config.read()
    expect(state.version).toBe(2)
    expect(state.configVersion).toBe(0)
    expect(state.sites).toEqual({})
  })

  it('carries the legacy Google switch over', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())

    expect(await config.isEnabled('google', PRIMARY_ACCOUNT_ID)).toBe(true)
    expect(await config.isEnabled('chatgpt', PRIMARY_ACCOUNT_ID)).toBe(false)

    const state = await config.read()
    expect(state.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(state.sites.google.activeAccountId).toBe(PRIMARY_ACCOUNT_ID)
  })

  it('keeps a legacy profile that was switched off switched off', async () => {
    writeLegacy({ enabled: false })
    const config = new SiteSessionConfig(configPath())

    expect(await config.isEnabled('google', PRIMARY_ACCOUNT_ID)).toBe(false)
  })

  it('does not write when the state file already exists', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.read()
    const written = readFileSync(configPath(), 'utf8')

    await config.read()
    await config.read()

    expect(readFileSync(configPath(), 'utf8')).toBe(written)
    expect(await config.getConfigVersion()).toBe(0)
  })

  it('migrates only once', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())

    await config.read()
    const migrated = readFileSync(configPath(), 'utf8')
    await config.read()

    expect(readFileSync(configPath(), 'utf8')).toBe(migrated)
    expect(await config.isEnabled('google', PRIMARY_ACCOUNT_ID)).toBe(true)
  })

  it('does not read the legacy file again once the state file exists', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())
    await config.read()

    // The legacy file is not the authority any more: the state file is.
    writeLegacy({ enabled: false })
    await config.read()

    expect(await config.isEnabled('google', PRIMARY_ACCOUNT_ID)).toBe(true)
  })

  it('keeps the merged map when the migrated Google switch is turned off', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())
    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)

    await config.setEnabled('google', PRIMARY_ACCOUNT_ID, false)

    const raw = readRawConfig()
    expect(raw.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(false)
    expect(raw.sites.chatgpt.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
  })

  it('keeps every site that was switched on', async () => {
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)
    await config.setEnabled('claude', PRIMARY_ACCOUNT_ID, true)

    const raw = readRawConfig()
    expect(raw.sites.chatgpt.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(raw.sites.claude.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
  })

  it('keeps the migrated Google switch when another site is switched on', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())
    await config.read()

    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)

    const raw = readRawConfig()
    expect(raw.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(raw.sites.chatgpt.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
  })

  it('keeps the migrated Google switch when the first call is a write', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)

    const raw = readRawConfig()
    expect(raw.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(raw.sites.chatgpt.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
  })

  it('keeps a switch that was set while the first read was still running', async () => {
    // The migration and the first write race each other: neither may replace
    // the state the other one wrote.
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())

    await Promise.all([config.read(), config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)])

    const raw = readRawConfig()
    expect(raw.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(raw.sites.chatgpt.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(raw.configVersion).toBe(1)
  })

  it('does not replace the state that was written while the legacy file was read', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())

    // The legacy file is read slowly, so the migration lands *after* the
    // switch was written. The migration may not replace it.
    const realReadFile = fs.readFile
    let delayed = false
    const spy = vi.spyOn(fs, 'readFile').mockImplementation(async (file, encoding) => {
      if (!delayed && String(file).endsWith('gemini-web-session.json')) {
        delayed = true
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      return realReadFile(file, encoding)
    })

    try {
      await Promise.all([config.read(), config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)])
    } finally {
      spy.mockRestore()
    }

    const raw = readRawConfig()
    expect(raw.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(raw.sites.chatgpt.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(raw.configVersion).toBe(1)
  })

  it('does not let a second instance drop what the first one wrote', async () => {
    const first = new SiteSessionConfig(configPath())
    const second = new SiteSessionConfig(configPath())

    // The second instance reads the file before the first one writes it.
    await second.read()
    await first.setEnabled('google', PRIMARY_ACCOUNT_ID, true)
    await second.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)

    const raw = readRawConfig()
    expect(raw.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(raw.sites.chatgpt.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
  })

  it('advances the version only when a switch really changes', async () => {
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)
    expect(await config.getConfigVersion()).toBe(1)

    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)
    expect(await config.getConfigVersion()).toBe(1)

    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, false)
    expect(await config.getConfigVersion()).toBe(2)
  })

  it('records the import result without changing the version or the switch', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)
    const version = await config.getConfigVersion()

    await config.recordResult('chatgpt', PRIMARY_ACCOUNT_ID, 'imported')

    const state = await config.read()
    expect(state.configVersion).toBe(version)
    const record = state.sites.chatgpt.accounts[PRIMARY_ACCOUNT_ID]
    expect(record.enabled).toBe(true)
    expect(record.lastResult).toBe('imported')
    expect(record.importedAt).not.toBeNull()
  })

  it('records a failed import with its error', async () => {
    const config = new SiteSessionConfig(configPath())

    await config.recordResult('chatgpt', PRIMARY_ACCOUNT_ID, 'failed', 'the bridge is gone')

    const state = await config.read()
    const record = state.sites.chatgpt.accounts[PRIMARY_ACCOUNT_ID]
    expect(record.enabled).toBe(false)
    expect(record.lastResult).toBe('failed')
    expect(record.lastError).toBe('the bridge is gone')
  })

  it('never writes a site or account id the file may not carry', async () => {
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('__proto__', PRIMARY_ACCOUNT_ID, true)
    await config.recordResult('constructor', PRIMARY_ACCOUNT_ID, 'imported')
    await config.setEnabled('google', '__proto__', true)

    expect(Object.keys(readRawConfig().sites)).toEqual([])
  })

  it('keeps the counter of a file that holds it as a string', async () => {
    writeRawConfig({ version: 1, configVersion: '3', targets: {} })
    const config = new SiteSessionConfig(configPath())

    expect(await config.getConfigVersion()).toBe(3)

    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)
    expect(await config.getConfigVersion()).toBe(4)
  })

  it('keeps the version of a file written by a newer build', async () => {
    writeRawConfig({ version: 3, configVersion: 0, sites: {} })
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)

    const raw = JSON.parse(readFileSync(configPath(), 'utf8'))
    expect(raw.version).toBe(3)
  })

  it('keeps the version of a newer build that wrote it as a string', async () => {
    writeRawConfig({ version: '3', configVersion: 0, sites: {} })
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)

    const raw = JSON.parse(readFileSync(configPath(), 'utf8'))
    expect(raw.version).toBe(3)
  })

  it('writes the new format when the state file is empty', async () => {
    writeRawConfig({})
    const config = new SiteSessionConfig(configPath())

    const state = await config.read()

    expect(state).toEqual({ version: 2, configVersion: 0, sites: {} })
    expect(JSON.parse(readFileSync(configPath(), 'utf8'))).toEqual(state)
  })

  it('keeps the fields this build does not know', async () => {
    writeRawConfig({ version: 1, configVersion: 0, targets: {}, future: { keep: true } })
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)

    const raw = JSON.parse(readFileSync(configPath(), 'utf8'))
    expect(raw.future).toEqual({ keep: true })
  })

  it('reports a failed write instead of pretending the switch was set', async () => {
    const filePath = configPath()
    const config = new SiteSessionConfig(filePath)
    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)

    // A folder where the state file should be: every write fails.
    rmSync(filePath)
    mkdirSync(filePath, { recursive: true })

    await expect(config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, false)).rejects.toThrow(
      /could not be written/
    )
    await expect(config.recordResult('chatgpt', PRIMARY_ACCOUNT_ID, 'imported')).rejects.toThrow(
      /could not be written/
    )
  })

  it('reports a failed migration instead of losing the legacy switch silently', async () => {
    // The folder the state file should be in is a file: every write fails.
    const blocker = path.join(tempDir, 'blocker')
    writeFileSync(blocker, 'not a folder', 'utf8')
    const config = new SiteSessionConfig(path.join(blocker, 'site-sessions.json'))

    await expect(config.read()).rejects.toThrow(/could not be migrated/)
  })

  it('removes the state of a site that does not exist any more', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)
    await config.setEnabled('custom:custom_1', PRIMARY_ACCOUNT_ID, true)
    await config.createAccount('custom:custom_1', 'a1', 'fp-1')

    await config.forget('custom:custom_1')

    const state = await config.read()
    expect(state.sites['custom:custom_1']).toBeUndefined()
    expect(state.sites.chatgpt.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
  })

  it('advances the version when a site is removed', async () => {
    // The extension polls the version: a site that is gone has to leave the
    // list it polls.
    const config = new SiteSessionConfig(configPath())
    await config.setEnabled('custom:custom_1', PRIMARY_ACCOUNT_ID, true)
    const version = await config.getConfigVersion()

    await config.forget('custom:custom_1')

    expect(await config.getConfigVersion()).toBe(version + 1)
  })

  it('leaves the version alone when there was nothing to remove', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)
    const version = await config.getConfigVersion()

    await config.forget('custom:custom_1')

    expect(await config.getConfigVersion()).toBe(version)
  })

  it('writes the switch of one account without touching the other accounts', async () => {
    const filePath = configPath()
    const config = new SiteSessionConfig(filePath)
    await config.setEnabled('google', PRIMARY_ACCOUNT_ID, true)
    await config.createAccount('google', 'a1', 'fp-1')
    await config.setEnabled('google', 'a1', true)
    await config.setEnabled('google', PRIMARY_ACCOUNT_ID, false)
    const state = await config.read()
    expect(state.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(false)
    expect(state.sites.google.accounts.a1.enabled).toBe(true)
  })

  it('migrates an old file once and keeps the config version', async () => {
    const filePath = configPath()
    await fs.writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        configVersion: 4,
        targets: {
          google: { enabled: true, importedAt: null, lastResult: null, lastError: null }
        }
      })
    )
    const config = new SiteSessionConfig(filePath)
    const state = await config.read()
    expect(state.version).toBe(2)
    expect(state.configVersion).toBe(4)
    expect(state.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    const written = JSON.parse(await fs.readFile(filePath, 'utf8'))
    expect(written.version).toBe(2)
  })

  it('does not migrate a file that is already in the new shape', async () => {
    const filePath = configPath()
    const contents = {
      version: 2,
      configVersion: 1,
      sites: {
        google: {
          accounts: { a1: account({ name: 'İş', enabled: true, fingerprints: ['fp-1'] }) },
          activeAccountId: 'a1'
        }
      }
    }
    writeRawConfig(contents)
    const config = new SiteSessionConfig(filePath)

    const state = await config.read()

    expect(state).toEqual(contents)
    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual(contents)
  })

  it('advances the config version when an account appears and when one is deleted', async () => {
    const filePath = configPath()
    const config = new SiteSessionConfig(filePath)
    const before = await config.getConfigVersion()
    await config.createAccount('google', 'a1', 'fp-1')
    expect(await config.getConfigVersion()).toBe(before + 1)
    await config.deleteAccount('google', 'a1')
    expect(await config.getConfigVersion()).toBe(before + 2)
  })

  it('does not advance the config version when an account is renamed', async () => {
    const filePath = configPath()
    const config = new SiteSessionConfig(filePath)
    await config.createAccount('google', 'a1', 'fp-1')
    const before = await config.getConfigVersion()
    await config.renameAccount('google', 'a1', 'İş')
    expect(await config.getConfigVersion()).toBe(before)
  })

  it('keeps an empty account name as no name', async () => {
    writeRawConfig({
      version: 2,
      configVersion: 0,
      sites: {
        google: {
          accounts: { a1: account({ name: '' }) },
          activeAccountId: 'a1'
        }
      }
    })
    const config = new SiteSessionConfig(configPath())

    expect((await config.read()).sites.google.accounts.a1.name).toBeNull()
  })

  it('renames an account and turns an empty name into no name', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.createAccount('google', 'a1', 'fp-1')

    await config.renameAccount('google', 'a1', 'İş')
    expect((await config.read()).sites.google.accounts.a1.name).toBe('İş')

    await config.renameAccount('google', 'a1', '')
    expect((await config.read()).sites.google.accounts.a1.name).toBeNull()
  })

  it('refuses to delete the primary account', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.setEnabled('google', PRIMARY_ACCOUNT_ID, true)

    await expect(config.deleteAccount('google', PRIMARY_ACCOUNT_ID)).rejects.toThrow(
      'primary account cannot be deleted'
    )
  })

  it('records the import result on the account it belongs to', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.createAccount('google', 'a1', 'fp-1')
    const version = await config.getConfigVersion()

    await config.recordResult('google', 'a1', 'imported')

    const state = await config.read()
    expect(state.configVersion).toBe(version)
    expect(state.sites.google.accounts.a1.lastResult).toBe('imported')
    expect(state.sites.google.accounts[PRIMARY_ACCOUNT_ID]).toBeUndefined()
  })

  it('writes the active account without changing the version', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.createAccount('google', 'a1', 'fp-1')
    const version = await config.getConfigVersion()

    await config.setActiveAccount('google', 'a1')

    const state = await config.read()
    expect(state.sites.google.activeAccountId).toBe('a1')
    expect(state.configVersion).toBe(version)
  })

  it('does not point a site at an account it does not have', async () => {
    const config = new SiteSessionConfig(configPath())

    await config.setActiveAccount('google', 'ghost')
    expect((await config.read()).sites).toEqual({})

    await config.createAccount('google', 'a1', 'fp-1')
    await config.setActiveAccount('google', 'a1')
    await config.setActiveAccount('google', 'ghost')

    expect((await config.read()).sites.google.activeAccountId).toBe('a1')
  })

  it('clears the active account when that account is deleted', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.setEnabled('google', PRIMARY_ACCOUNT_ID, true)
    await config.createAccount('google', 'a1', 'fp-1')
    await config.setActiveAccount('google', 'a1')

    await config.deleteAccount('google', 'a1')

    const state = await config.read()
    expect(state.sites.google.accounts[PRIMARY_ACCOUNT_ID].enabled).toBe(true)
    expect(state.sites.google.activeAccountId).toBeNull()
  })

  it('removes the site when its last account is deleted', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.createAccount('google', 'a1', 'fp-1')

    await config.deleteAccount('google', 'a1')

    expect((await config.read()).sites.google).toBeUndefined()
  })

  it('keeps an existing account when it is written again', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.createAccount('google', 'a1', 'fp-1')
    await config.renameAccount('google', 'a1', 'İş')
    await config.setEnabled('google', 'a1', false)
    await config.recordResult('google', 'a1', 'imported')
    const version = await config.getConfigVersion()

    await config.createAccount('google', 'a1', 'fp-2')

    const state = await config.read()
    const existing = state.sites.google.accounts.a1
    expect(existing.name).toBe('İş')
    expect(existing.enabled).toBe(false)
    expect(existing.importedAt).not.toBeNull()
    expect(existing.lastResult).toBe('imported')
    expect(existing.fingerprints).toEqual(['fp-1', 'fp-2'])
    expect(state.configVersion).toBe(version)
  })

  it('keeps the fields of an existing account that this build does not know', async () => {
    writeRawConfig({
      version: 2,
      configVersion: 0,
      sites: {
        google: {
          accounts: { a1: { ...account({ enabled: true }), futureField: 'kept' } },
          activeAccountId: 'a1'
        }
      }
    })
    const config = new SiteSessionConfig(configPath())

    await config.createAccount('google', 'a1', 'fp-2')

    expect((await config.read()).sites.google.accounts.a1).toMatchObject({ futureField: 'kept' })
  })

  it('does not add a fingerprint twice', async () => {
    const config = new SiteSessionConfig(configPath())
    for (const fingerprint of ['fp-1', 'fp-2', 'fp-3', 'fp-4', 'fp-5']) {
      await config.createAccount('google', 'a1', fingerprint)
    }
    const version = await config.getConfigVersion()

    await config.createAccount('google', 'a1', 'fp-3')

    const state = await config.read()
    expect(state.sites.google.accounts.a1.fingerprints).toEqual([
      'fp-1',
      'fp-2',
      'fp-3',
      'fp-4',
      'fp-5'
    ])
    expect(state.configVersion).toBe(version)
  })

  it('remembers a matched session fingerprint without advancing the version', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.createAccount('google', 'a1', 'fp-1')
    const version = await config.getConfigVersion()

    await config.rememberFingerprint('google', 'a1', 'fp-2')
    await config.rememberFingerprint('google', 'a1', 'fp-2')
    await config.rememberFingerprint('google', 'a1', null)

    const state = await config.read()
    expect(state.sites.google.accounts.a1.fingerprints).toEqual(['fp-1', 'fp-2'])
    expect(state.configVersion).toBe(version)
  })

  it('keeps at most five remembered fingerprints and never invents an account', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.createAccount('google', 'a1', 'fp-1')

    for (const fingerprint of ['fp-2', 'fp-3', 'fp-4', 'fp-5', 'fp-6']) {
      await config.rememberFingerprint('google', 'a1', fingerprint)
    }
    await config.rememberFingerprint('google', 'ghost', 'fp-7')

    const state = await config.read()
    expect(state.sites.google.accounts.a1.fingerprints).toEqual([
      'fp-2',
      'fp-3',
      'fp-4',
      'fp-5',
      'fp-6'
    ])
    expect(state.sites.google.accounts.ghost).toBeUndefined()
  })

  it('reports a failed write from every account mutation', async () => {
    const filePath = configPath()
    const config = new SiteSessionConfig(filePath)
    await config.createAccount('google', 'a1', 'fp-1')
    await config.createAccount('google', 'a2', 'fp-2')
    await config.setActiveAccount('google', 'a1')

    // A folder where the state file should be: every write fails.
    rmSync(filePath)
    mkdirSync(filePath, { recursive: true })

    await expect(config.createAccount('google', 'a1', 'fp-3')).rejects.toThrow(
      /could not be written/
    )
    await expect(config.rememberFingerprint('google', 'a1', 'fp-9')).rejects.toThrow(
      /could not be written/
    )
    await expect(config.renameAccount('google', 'a1', 'İş')).rejects.toThrow(/could not be written/)
    await expect(config.setActiveAccount('google', 'a2')).rejects.toThrow(/could not be written/)
    await expect(config.deleteAccount('google', 'a1')).rejects.toThrow(/could not be removed/)
    await expect(config.forget('google')).rejects.toThrow(/could not be removed/)
  })

  it('keeps at most five fingerprints of an account, dropping the oldest', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.createAccount('google', 'a1', 'fp-1')

    for (const fingerprint of ['fp-2', 'fp-3', 'fp-4', 'fp-5', 'fp-6']) {
      await config.createAccount('google', 'a1', fingerprint)
    }

    expect((await config.read()).sites.google.accounts.a1.fingerprints).toEqual([
      'fp-2',
      'fp-3',
      'fp-4',
      'fp-5',
      'fp-6'
    ])
  })
})

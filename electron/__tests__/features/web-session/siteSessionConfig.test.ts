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
import type { SiteSessionConfigFile } from '../../../features/web-session/siteSessionConfig.js'
import { deriveSiteSessionStatus } from '../../../features/web-session/siteSessionStatus.js'

/** The user data folder the app keeps its state in. */
const USER_DATA = path.join(os.tmpdir(), 'quizlab-user-data')

vi.mock('electron', () => ({
  app: {
    getPath: () => USER_DATA
  }
}))

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
    version: 1,
    configVersion: 1,
    targets: {
      chatgpt: {
        enabled: true,
        importedAt: null,
        lastResult: null,
        lastError: null
      }
    }
  }

  it('adds the migrated switch to the state that is already there', () => {
    const merged = mergeLegacyGoogleState(stateWithChatgpt, true)

    expect(merged.targets.google.enabled).toBe(true)
    expect(merged.targets.chatgpt.enabled).toBe(true)
    expect(merged.configVersion).toBe(1)
  })

  it('leaves a state that already has a Google switch alone', () => {
    const state: SiteSessionConfigFile = {
      ...stateWithChatgpt,
      targets: {
        ...stateWithChatgpt.targets,
        google: {
          enabled: false,
          importedAt: null,
          lastResult: null,
          lastError: null
        }
      }
    }

    const merged = mergeLegacyGoogleState(state, true)

    // The user turned the Google switch off in the new app; the legacy file
    // may not turn it back on.
    expect(merged.targets.google.enabled).toBe(false)
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

  function readRawConfig(): {
    version: number
    configVersion: number
    targets: Record<string, { enabled: boolean }>
  } {
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

    expect(await config.isEnabled('google')).toBe(false)
    expect(await config.isEnabled('chatgpt')).toBe(false)

    const state = await config.read()
    expect(state.version).toBe(1)
    expect(state.configVersion).toBe(0)
    expect(state.targets).toEqual({})
  })

  it('carries the legacy Google switch over', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())

    expect(await config.isEnabled('google')).toBe(true)
    expect(await config.isEnabled('chatgpt')).toBe(false)
  })

  it('keeps a legacy profile that was switched off switched off', async () => {
    writeLegacy({ enabled: false })
    const config = new SiteSessionConfig(configPath())

    expect(await config.isEnabled('google')).toBe(false)
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
    expect(await config.isEnabled('google')).toBe(true)
  })

  it('does not read the legacy file again once the state file exists', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())
    await config.read()

    // The legacy file is not the authority any more: the state file is.
    writeLegacy({ enabled: false })
    await config.read()

    expect(await config.isEnabled('google')).toBe(true)
  })

  it('keeps the merged map when the migrated Google switch is turned off', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())
    await config.setEnabled('chatgpt', true)

    await config.setEnabled('google', false)

    const raw = readRawConfig()
    expect(raw.targets.google.enabled).toBe(false)
    expect(raw.targets.chatgpt.enabled).toBe(true)
  })

  it('keeps every site that was switched on', async () => {
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('chatgpt', true)
    await config.setEnabled('claude', true)

    const raw = readRawConfig()
    expect(raw.targets.chatgpt.enabled).toBe(true)
    expect(raw.targets.claude.enabled).toBe(true)
  })

  it('keeps the migrated Google switch when another site is switched on', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())
    await config.read()

    await config.setEnabled('chatgpt', true)

    const raw = readRawConfig()
    expect(raw.targets.google.enabled).toBe(true)
    expect(raw.targets.chatgpt.enabled).toBe(true)
  })

  it('keeps the migrated Google switch when the first call is a write', async () => {
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('chatgpt', true)

    const raw = readRawConfig()
    expect(raw.targets.google.enabled).toBe(true)
    expect(raw.targets.chatgpt.enabled).toBe(true)
  })

  it('keeps a switch that was set while the first read was still running', async () => {
    // The migration and the first write race each other: neither may replace
    // the state the other one wrote.
    writeLegacy({ enabled: true })
    const config = new SiteSessionConfig(configPath())

    await Promise.all([config.read(), config.setEnabled('chatgpt', true)])

    const raw = readRawConfig()
    expect(raw.targets.google.enabled).toBe(true)
    expect(raw.targets.chatgpt.enabled).toBe(true)
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
      await Promise.all([config.read(), config.setEnabled('chatgpt', true)])
    } finally {
      spy.mockRestore()
    }

    const raw = readRawConfig()
    expect(raw.targets.google.enabled).toBe(true)
    expect(raw.targets.chatgpt.enabled).toBe(true)
    expect(raw.configVersion).toBe(1)
  })

  it('does not let a second instance drop what the first one wrote', async () => {
    const first = new SiteSessionConfig(configPath())
    const second = new SiteSessionConfig(configPath())

    // The second instance reads the file before the first one writes it.
    await second.read()
    await first.setEnabled('google', true)
    await second.setEnabled('chatgpt', true)

    const raw = readRawConfig()
    expect(raw.targets.google.enabled).toBe(true)
    expect(raw.targets.chatgpt.enabled).toBe(true)
  })

  it('advances the version only when a switch really changes', async () => {
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('chatgpt', true)
    expect(await config.getConfigVersion()).toBe(1)

    await config.setEnabled('chatgpt', true)
    expect(await config.getConfigVersion()).toBe(1)

    await config.setEnabled('chatgpt', false)
    expect(await config.getConfigVersion()).toBe(2)
  })

  it('records the import result without changing the version or the switch', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.setEnabled('chatgpt', true)
    const version = await config.getConfigVersion()

    await config.recordResult('chatgpt', 'imported')

    const state = await config.read()
    expect(state.configVersion).toBe(version)
    expect(state.targets.chatgpt.enabled).toBe(true)
    expect(state.targets.chatgpt.lastResult).toBe('imported')
    expect(state.targets.chatgpt.importedAt).not.toBeNull()
  })

  it('records a failed import with its error', async () => {
    const config = new SiteSessionConfig(configPath())

    await config.recordResult('chatgpt', 'failed', 'the bridge is gone')

    const state = await config.read()
    expect(state.targets.chatgpt.enabled).toBe(false)
    expect(state.targets.chatgpt.lastResult).toBe('failed')
    expect(state.targets.chatgpt.lastError).toBe('the bridge is gone')
  })

  it('never writes a site id the file may not carry', async () => {
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('__proto__', true)
    await config.recordResult('constructor', 'imported')

    expect(Object.keys(readRawConfig().targets)).toEqual([])
  })

  it('keeps the counter of a file that holds it as a string', async () => {
    writeRawConfig({ version: 1, configVersion: '3', targets: {} })
    const config = new SiteSessionConfig(configPath())

    expect(await config.getConfigVersion()).toBe(3)

    await config.setEnabled('chatgpt', true)
    expect(await config.getConfigVersion()).toBe(4)
  })

  it('keeps the version of a file written by a newer build', async () => {
    writeRawConfig({ version: 2, configVersion: 0, targets: {} })
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('chatgpt', true)

    const raw = JSON.parse(readFileSync(configPath(), 'utf8'))
    expect(raw.version).toBe(2)
  })

  it('keeps the fields this build does not know', async () => {
    writeRawConfig({ version: 1, configVersion: 0, targets: {}, future: { keep: true } })
    const config = new SiteSessionConfig(configPath())

    await config.setEnabled('chatgpt', true)

    const raw = JSON.parse(readFileSync(configPath(), 'utf8'))
    expect(raw.future).toEqual({ keep: true })
  })

  it('reports a failed write instead of pretending the switch was set', async () => {
    // A folder where the state file should be: every write fails.
    mkdirSync(configPath(), { recursive: true })
    const config = new SiteSessionConfig(configPath())

    await expect(config.setEnabled('chatgpt', true)).rejects.toThrow(/could not be written/)
    await expect(config.recordResult('chatgpt', 'imported')).rejects.toThrow(/could not be written/)
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
    await config.setEnabled('chatgpt', true)
    await config.setEnabled('custom:custom_1', true)

    await config.forget('custom:custom_1')

    const state = await config.read()
    expect(state.targets['custom:custom_1']).toBeUndefined()
    expect(state.targets.chatgpt.enabled).toBe(true)
  })

  it('advances the version when a site is removed', async () => {
    // The extension polls the version: a site that is gone has to leave the
    // list it polls.
    const config = new SiteSessionConfig(configPath())
    await config.setEnabled('custom:custom_1', true)
    const version = await config.getConfigVersion()

    await config.forget('custom:custom_1')

    expect(await config.getConfigVersion()).toBe(version + 1)
  })

  it('leaves the version alone when there was nothing to remove', async () => {
    const config = new SiteSessionConfig(configPath())
    await config.setEnabled('chatgpt', true)
    const version = await config.getConfigVersion()

    await config.forget('custom:custom_1')

    expect(await config.getConfigVersion()).toBe(version)
  })
})

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SiteSessionConfig,
  getSiteSessionConfigPath,
  migrateLegacyGoogleEnabled
} from '../../../features/web-session/siteSessionConfig.js'
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
})

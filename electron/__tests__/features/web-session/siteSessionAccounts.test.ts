import { existsSync, mkdirSync, mkdtempSync, promises as fs, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { configRead, targetRows, userData, hoistedMocks } = vi.hoisted(() => {
  return {
    configRead: vi.fn(),
    targetRows: [] as SiteSessionTargetRow[],
    userData: { path: '' },
    hoistedMocks: {
      registerAccountPartition: vi.fn(),
      unregisterAccountPartition: vi.fn(),
      registerDynamicPartition: vi.fn(),
      setupAiSession: vi.fn()
    }
  }
})

vi.mock('electron', () => ({
  app: {
    getPath: () => userData.path
  }
}))

vi.mock('../../../app/window/permissionPolicy.js', () => ({
  registerAccountPartition: hoistedMocks.registerAccountPartition,
  unregisterAccountPartition: hoistedMocks.unregisterAccountPartition
}))

vi.mock('../../../core/cacheRegistry.js', () => ({
  registerDynamicPartition: hoistedMocks.registerDynamicPartition
}))

vi.mock('../../../features/web-session/siteSessionConfig.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../features/web-session/siteSessionConfig.js')>()
  return {
    ...actual,
    getSiteSessionConfig: () => ({ read: configRead })
  }
})

vi.mock('../../../features/web-session/siteSessionTargets.js', () => ({
  buildSiteSessionTargets: vi.fn(async () => targetRows)
}))

import { PRIMARY_ACCOUNT_ID } from '../../../../shared/types/siteSession.js'
import {
  accountPartitionFor,
  buildAccountRows,
  isPrimaryAccount,
  registerSiteSessionPartitions,
  resolveActiveAccountPartition
} from '../../../features/web-session/siteSessionAccounts.js'
import type {
  SiteSessionAccountState,
  SiteSessionConfigFile
} from '../../../features/web-session/siteSessionMigration.js'
import { removePartitionDirectory } from '../../../features/web-session/siteSessionPartitions.js'
import type { SiteSessionTargetRow } from '../../../features/web-session/siteSessionTargets.js'

/** An account that was never touched: unnamed, off, no history. */
function primaryState(overrides: Partial<SiteSessionAccountState> = {}): SiteSessionAccountState {
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

/** A state file that was never written for a site. */
function emptyState(): SiteSessionConfigFile {
  return { version: 2, configVersion: 0, sites: {} }
}

describe('accountPartitionFor', () => {
  it('builds a partition the cache whitelist accepts', () => {
    expect(accountPartitionFor('google', 'a1')).toBe('persist:ai_google_a1')
    expect(accountPartitionFor('custom:custom_abc', 'a1')).toBe('persist:ai_custom_custom_abc_a1')
    expect(accountPartitionFor('google', 'a1')).toMatch(/^persist:ai_[\w-]+$/)
    expect(accountPartitionFor('custom:custom_abc', 'a1')).toMatch(/^persist:ai_[\w-]+$/)
  })

  it('sanitises an account id the cache whitelist would reject', () => {
    const partition = accountPartitionFor('google', 'a:b')

    expect(partition).toBe('persist:ai_google_a_b')
    expect(partition).toMatch(/^persist:ai_[\w-]+$/)
  })
})

describe('isPrimaryAccount', () => {
  it('recognises only the id every site owns', () => {
    expect(isPrimaryAccount(PRIMARY_ACCOUNT_ID)).toBe(true)
    expect(isPrimaryAccount('a1')).toBe(false)
  })
})

describe('buildAccountRows', () => {
  const sites: SiteSessionTargetRow[] = [
    {
      siteId: 'google',
      labelKey: 'ws_target_google',
      kind: 'google',
      memberAppIds: ['gemini'],
      hostname: 'gemini.google.com',
      origins: ['https://gemini.google.com'],
      cookieDomains: ['.google.com'],
      partition: 'persist:gemini_web_profile'
    }
  ]

  it('gives a site without a state a primary account on the platform partition', () => {
    const rows = buildAccountRows(sites, emptyState())
    expect(rows).toHaveLength(1)
    expect(rows[0].accountId).toBe(PRIMARY_ACCOUNT_ID)
    expect(rows[0].partition).toBe('persist:gemini_web_profile')
    expect(rows[0].state.enabled).toBe(false)
  })

  it('gives an additional account its own partition', () => {
    const state: SiteSessionConfigFile = {
      version: 2,
      configVersion: 0,
      sites: {
        google: {
          accounts: {
            primary: primaryState(),
            a1: { ...primaryState(), enabled: true }
          },
          activeAccountId: 'primary'
        }
      }
    }
    const rows = buildAccountRows(sites, state)
    expect(rows.map((row) => row.partition)).toEqual([
      'persist:gemini_web_profile',
      'persist:ai_google_a1'
    ])
  })

  it('describes the synthetic primary with the untouched state', () => {
    const [row] = buildAccountRows(sites, emptyState())
    expect(row.isPrimary).toBe(true)
    expect(row.siteId).toBe('google')
    expect(row.state).toEqual({
      name: null,
      enabled: false,
      importedAt: null,
      lastResult: null,
      lastError: null,
      fingerprints: []
    })
  })

  it('does not mutate the state it reads', () => {
    const state = emptyState()
    Object.freeze(state.sites)
    Object.freeze(state)

    const rows = buildAccountRows(sites, state)

    expect(rows).toHaveLength(1)
    expect(state.sites).toEqual({})
  })

  it('treats a site entry without accounts as a site without a state', () => {
    const state: SiteSessionConfigFile = {
      ...emptyState(),
      sites: { google: { accounts: {}, activeAccountId: null } }
    }
    const rows = buildAccountRows(sites, state)
    expect(rows.map((row) => row.accountId)).toEqual([PRIMARY_ACCOUNT_ID])
  })

  it('synthesises a primary account when the state holds only an additional one', () => {
    const state: SiteSessionConfigFile = {
      ...emptyState(),
      sites: {
        google: {
          accounts: { a1: primaryState({ enabled: true }) },
          activeAccountId: 'a1'
        }
      }
    }
    const rows = buildAccountRows(sites, state)

    expect(rows.map((row) => row.accountId)).toEqual(['primary', 'a1'])
    expect(rows.map((row) => row.partition)).toEqual([
      'persist:gemini_web_profile',
      'persist:ai_google_a1'
    ])
    expect(rows[0].state).toEqual({
      name: null,
      enabled: false,
      importedAt: null,
      lastResult: null,
      lastError: null,
      fingerprints: []
    })
  })

  it('keeps the primary account first and the additional ones in insertion order', () => {
    const state: SiteSessionConfigFile = {
      ...emptyState(),
      sites: {
        google: {
          accounts: {
            a1: primaryState({ enabled: true }),
            primary: primaryState(),
            a2: primaryState()
          },
          activeAccountId: 'primary'
        }
      }
    }
    const rows = buildAccountRows(sites, state)
    expect(rows.map((row) => row.accountId)).toEqual(['primary', 'a1', 'a2'])
    expect(rows.map((row) => row.isPrimary)).toEqual([true, false, false])
  })

  it('keeps the state a persisted account carries', () => {
    const importedAt = '2026-10-19T10:00:00.000Z'
    const state: SiteSessionConfigFile = {
      ...emptyState(),
      sites: {
        google: {
          accounts: {
            primary: primaryState({ enabled: true, importedAt, lastResult: 'imported' })
          },
          activeAccountId: PRIMARY_ACCOUNT_ID
        }
      }
    }
    const [row] = buildAccountRows(sites, state)
    expect(row.state).toEqual({
      name: null,
      enabled: true,
      importedAt,
      lastResult: 'imported',
      lastError: null,
      fingerprints: []
    })
  })
})

describe('resolveActiveAccountPartition', () => {
  beforeEach(() => {
    targetRows.length = 0
    targetRows.push({
      siteId: 'google',
      labelKey: 'ws_target_google',
      kind: 'google',
      memberAppIds: ['gemini'],
      hostname: 'gemini.google.com',
      origins: ['https://gemini.google.com'],
      cookieDomains: ['.google.com'],
      partition: 'persist:gemini_web_profile'
    })
    configRead.mockReset()
  })

  it('returns the partition of the active account', async () => {
    const state: SiteSessionConfigFile = {
      ...emptyState(),
      sites: {
        google: {
          accounts: { primary: primaryState(), a1: primaryState({ enabled: true }) },
          activeAccountId: 'a1'
        }
      }
    }
    configRead.mockResolvedValue(state)
    await expect(resolveActiveAccountPartition('google')).resolves.toBe('persist:ai_google_a1')
  })

  it('returns the platform partition when the primary account is active', async () => {
    const state: SiteSessionConfigFile = {
      ...emptyState(),
      sites: {
        google: { accounts: { primary: primaryState() }, activeAccountId: PRIMARY_ACCOUNT_ID }
      }
    }
    configRead.mockResolvedValue(state)
    await expect(resolveActiveAccountPartition('google')).resolves.toBe(
      'persist:gemini_web_profile'
    )
  })

  it('returns null when the site has no active account', async () => {
    configRead.mockResolvedValue(emptyState())
    await expect(resolveActiveAccountPartition('google')).resolves.toBeNull()
  })

  it('returns null when the site is not one of the targets', async () => {
    const state: SiteSessionConfigFile = {
      ...emptyState(),
      sites: {
        google: { accounts: { primary: primaryState() }, activeAccountId: PRIMARY_ACCOUNT_ID }
      }
    }
    configRead.mockResolvedValue(state)
    targetRows.length = 0

    await expect(resolveActiveAccountPartition('google')).resolves.toBeNull()
  })

  it('returns null when the active account is gone from the state', async () => {
    const state: SiteSessionConfigFile = {
      ...emptyState(),
      sites: { google: { accounts: { primary: primaryState() }, activeAccountId: 'gone' } }
    }
    configRead.mockResolvedValue(state)
    await expect(resolveActiveAccountPartition('google')).resolves.toBeNull()
  })
})

describe('registerSiteSessionPartitions', () => {
  const { registerAccountPartition, registerDynamicPartition, setupAiSession } = hoistedMocks

  const googleRow = (overrides: Partial<SiteSessionTargetRow> = {}): SiteSessionTargetRow => ({
    siteId: 'google',
    labelKey: 'ws_target_google',
    kind: 'google',
    memberAppIds: ['gemini'],
    hostname: 'gemini.google.com',
    origins: ['https://gemini.google.com'],
    cookieDomains: ['.google.com'],
    partition: 'persist:gemini_web_profile',
    ...overrides
  })

  beforeEach(() => {
    registerAccountPartition.mockClear()
    registerDynamicPartition.mockClear()
    setupAiSession.mockClear()
  })

  it('registers, caches and configures each additional account', async () => {
    targetRows.length = 0
    targetRows.push(googleRow())
    configRead.mockResolvedValue({
      ...emptyState(),
      sites: {
        google: {
          accounts: { primary: primaryState(), a1: primaryState({ enabled: true }) },
          activeAccountId: 'primary'
        }
      }
    })

    await registerSiteSessionPartitions(setupAiSession)

    expect(registerAccountPartition).toHaveBeenCalledTimes(1)
    expect(registerAccountPartition).toHaveBeenCalledWith(
      'persist:ai_google_a1',
      'https://gemini.google.com'
    )
    expect(registerDynamicPartition).toHaveBeenCalledWith('persist:ai_google_a1')
    expect(setupAiSession).toHaveBeenCalledWith('persist:ai_google_a1')
  })

  it('does not re-register the partition the primary account shares', async () => {
    targetRows.length = 0
    targetRows.push(googleRow())
    configRead.mockResolvedValue({
      ...emptyState(),
      sites: {
        google: {
          accounts: { primary: primaryState() },
          activeAccountId: PRIMARY_ACCOUNT_ID
        }
      }
    })

    await registerSiteSessionPartitions(setupAiSession)

    expect(registerAccountPartition).not.toHaveBeenCalled()
    expect(registerDynamicPartition).not.toHaveBeenCalled()
    expect(setupAiSession).not.toHaveBeenCalled()
  })

  it('registers every origin of a multi-origin site', async () => {
    targetRows.length = 0
    targetRows.push(
      googleRow({
        origins: ['https://gemini.google.com', 'https://drive.google.com']
      })
    )
    configRead.mockResolvedValue({
      ...emptyState(),
      sites: { google: { accounts: { a1: primaryState() }, activeAccountId: null } }
    })

    await registerSiteSessionPartitions(setupAiSession)

    expect(registerAccountPartition.mock.calls).toEqual([
      ['persist:ai_google_a1', 'https://gemini.google.com'],
      ['persist:ai_google_a1', 'https://drive.google.com']
    ])
    expect(setupAiSession).toHaveBeenCalledTimes(1)
  })

  it('registers the permission policy before configuring the session', async () => {
    targetRows.length = 0
    targetRows.push(googleRow())
    configRead.mockResolvedValue({
      ...emptyState(),
      sites: { google: { accounts: { a1: primaryState() }, activeAccountId: null } }
    })

    await registerSiteSessionPartitions(setupAiSession)

    expect(registerAccountPartition.mock.invocationCallOrder[0]).toBeLessThan(
      setupAiSession.mock.invocationCallOrder[0]
    )
    expect(registerDynamicPartition.mock.invocationCallOrder[0]).toBeLessThan(
      setupAiSession.mock.invocationCallOrder[0]
    )
  })

  it('covers every site it has rows for', async () => {
    targetRows.length = 0
    targetRows.push(googleRow(), {
      siteId: 'custom:custom_abc',
      hostname: 'local.example.com',
      origins: ['https://local.example.com'],
      cookieDomains: ['.local.example.com'],
      partition: 'persist:ai_custom_custom_abc',
      labelKey: 'ws_target_custom',
      kind: 'custom',
      memberAppIds: ['custom_abc']
    })
    configRead.mockResolvedValue({
      ...emptyState(),
      sites: {
        google: { accounts: { primary: primaryState(), a1: primaryState() } },
        'custom:custom_abc': {
          accounts: { a0: primaryState(), a1: primaryState() },
          activeAccountId: null
        }
      }
    })

    await registerSiteSessionPartitions(setupAiSession)

    expect(setupAiSession.mock.calls).toEqual([
      ['persist:ai_google_a1'],
      ['persist:ai_custom_custom_abc_a0'],
      ['persist:ai_custom_custom_abc_a1']
    ])
  })
})

describe('removePartitionDirectory', () => {
  beforeEach(() => {
    userData.path = mkdtempSync(path.join(os.tmpdir(), 'quizlab-partitions-'))
  })

  afterEach(() => {
    rmSync(userData.path, { recursive: true, force: true })
  })

  it('removes the folder a partition keeps its data in', async () => {
    const directory = path.join(userData.path, 'Partitions', 'ai_google_a1')
    mkdirSync(path.join(directory, 'Cookies'), { recursive: true })

    await removePartitionDirectory('persist:ai_google_a1')

    expect(existsSync(directory)).toBe(false)
  })

  it('does not throw when the partition was never used', async () => {
    await expect(removePartitionDirectory('persist:ai_google_a1')).resolves.toBeUndefined()
  })

  it('propagates a failed deletion instead of swallowing it', async () => {
    const failure = new Error('EPERM: operation not permitted')
    const remove = vi.spyOn(fs, 'rm').mockRejectedValueOnce(failure)

    try {
      await expect(removePartitionDirectory('persist:ai_google_a1')).rejects.toBe(failure)
    } finally {
      remove.mockRestore()
    }
  })
})

import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { configRead, targetRows, userData } = vi.hoisted(() => ({
  configRead: vi.fn(),
  targetRows: [] as SiteSessionTargetRow[],
  userData: { path: '' }
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => userData.path
  }
}))

vi.mock('../../../features/web-session/siteSessionConfig.js', () => ({
  getSiteSessionConfig: () => ({ read: configRead })
}))

vi.mock('../../../features/web-session/siteSessionTargets.js', () => ({
  buildSiteSessionTargets: vi.fn(async () => targetRows)
}))

import { PRIMARY_ACCOUNT_ID } from '../../../../shared/types/siteSession.js'
import {
  accountPartitionFor,
  buildAccountRows,
  isPrimaryAccount,
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

  it('treats a site entry without accounts as a site without a state', () => {
    const state: SiteSessionConfigFile = {
      ...emptyState(),
      sites: { google: { accounts: {}, activeAccountId: null } }
    }
    const rows = buildAccountRows(sites, state)
    expect(rows.map((row) => row.accountId)).toEqual([PRIMARY_ACCOUNT_ID])
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

  it('returns null when the active account is gone from the state', async () => {
    const state: SiteSessionConfigFile = {
      ...emptyState(),
      sites: { google: { accounts: { primary: primaryState() }, activeAccountId: 'gone' } }
    }
    configRead.mockResolvedValue(state)
    await expect(resolveActiveAccountPartition('google')).resolves.toBeNull()
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
})

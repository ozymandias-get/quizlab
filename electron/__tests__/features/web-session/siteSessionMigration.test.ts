import { describe, expect, it } from 'vitest'

import { migrateSiteSessionStateV1 } from '../../../features/web-session/siteSessionMigration.js'
import { PRIMARY_ACCOUNT_ID } from '../../../../shared/types/siteSession.js'

describe('migrateSiteSessionStateV1', () => {
  it('turns every old site into a primary account that keeps the old values', () => {
    const migrated = migrateSiteSessionStateV1({
      version: 1,
      configVersion: 7,
      targets: {
        google: {
          enabled: true,
          importedAt: '2026-10-19T10:00:00.000Z',
          lastResult: 'imported',
          lastError: null
        },
        chatgpt: { enabled: false, importedAt: null, lastResult: null, lastError: null }
      }
    })
    expect(migrated.version).toBe(2)
    expect(migrated.configVersion).toBe(7)
    expect(migrated.sites.google.accounts.primary).toMatchObject({
      enabled: true,
      importedAt: '2026-10-19T10:00:00.000Z',
      lastResult: 'imported',
      lastError: null
    })
    expect(migrated.sites.google.activeAccountId).toBe(PRIMARY_ACCOUNT_ID)
    expect(migrated.sites.chatgpt.accounts.primary.enabled).toBe(false)
  })

  it('carries every site of the old file over, even one that is gone from the registry', () => {
    const migrated = migrateSiteSessionStateV1({
      version: 1,
      configVersion: 0,
      targets: { gone: { enabled: true } }
    })
    expect(migrated.sites.gone.accounts.primary.enabled).toBe(true)
  })

  it('reads a state that is already the new shape without changing it', () => {
    const migrated = migrateSiteSessionStateV1({ version: 2, configVersion: 3, sites: {} })
    expect(migrated.version).toBe(2)
    expect(migrated.configVersion).toBe(3)
  })

  it('gives the migrated primary account the shape of a new account', () => {
    const migrated = migrateSiteSessionStateV1({
      version: 1,
      configVersion: 0,
      targets: { google: { enabled: true } }
    })
    expect(migrated.sites.google.accounts.primary).toEqual({
      name: null,
      enabled: true,
      importedAt: null,
      lastResult: null,
      lastError: null,
      fingerprints: []
    })
  })

  it('keeps the accounts of a state that is already the new shape', () => {
    const migrated = migrateSiteSessionStateV1({
      version: 2,
      configVersion: 3,
      sites: {
        google: {
          accounts: {
            primary: {
              name: null,
              enabled: true,
              importedAt: null,
              lastResult: 'imported',
              lastError: null,
              fingerprints: []
            },
            a1: {
              name: 'İş',
              enabled: true,
              importedAt: null,
              lastResult: null,
              lastError: null,
              fingerprints: ['fp-1']
            }
          },
          activeAccountId: 'a1'
        }
      }
    })
    expect(migrated.sites.google.accounts.a1.name).toBe('İş')
    expect(migrated.sites.google.accounts.a1.fingerprints).toEqual(['fp-1'])
    expect(migrated.sites.google.activeAccountId).toBe('a1')
  })

  it('drops the keys a state file may not carry', () => {
    // The file is read as JSON, and JSON.parse creates an own `__proto__`
    // property: a hand-written file can carry a key that must never reach
    // the state.
    const raw = JSON.parse(
      '{"version":1,"configVersion":0,"targets":{"__proto__":{"enabled":true},"constructor":{"enabled":true},"prototype":{"enabled":true},"google":{"enabled":true}}}'
    )
    const migrated = migrateSiteSessionStateV1(raw)
    expect(Object.keys(migrated.sites)).toEqual(['google'])
  })
})

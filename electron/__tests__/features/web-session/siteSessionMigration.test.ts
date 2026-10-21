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

  it('drops an account id a state file may not carry', () => {
    const raw = JSON.parse(
      '{"version":2,"configVersion":0,"sites":{"google":{"accounts":{"__proto__":{"enabled":true},"constructor":{"enabled":true},"a1":{"enabled":true}},"activeAccountId":"a1"}}}'
    )
    const migrated = migrateSiteSessionStateV1(raw)
    expect(Object.keys(migrated.sites.google.accounts)).toEqual(['a1'])
    // A `__proto__` id that reached the accounts would have replaced the
    // prototype of the map instead of adding a key to it.
    expect(Object.getPrototypeOf(migrated.sites.google.accounts)).toBe(Object.prototype)
  })

  it('drops an active account the site does not have', () => {
    const migrated = migrateSiteSessionStateV1({
      version: 2,
      configVersion: 0,
      sites: {
        google: {
          accounts: {
            a1: {
              name: null,
              enabled: true,
              importedAt: null,
              lastResult: null,
              lastError: null,
              fingerprints: []
            }
          },
          activeAccountId: 'a9'
        }
      }
    })
    expect(migrated.sites.google.activeAccountId).toBeNull()
  })

  it('keeps a file whose version was hand-edited into a string', () => {
    const migrated = migrateSiteSessionStateV1({
      version: '2',
      configVersion: 3,
      sites: {
        google: {
          accounts: {
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
    expect(migrated.version).toBe(2)
    expect(migrated.sites.google.accounts.a1.name).toBe('İş')
  })

  it('keeps a file whose version is missing or was hand-edited into nonsense', () => {
    for (const version of [undefined, 'two']) {
      const migrated = migrateSiteSessionStateV1({
        version,
        configVersion: 3,
        sites: {
          google: {
            accounts: {
              a1: {
                name: 'İş',
                enabled: true,
                importedAt: null,
                lastResult: null,
                lastError: null,
                fingerprints: []
              }
            },
            activeAccountId: 'a1'
          }
        }
      })
      expect(migrated.version).toBe(2)
      expect(migrated.sites.google.accounts.a1.name).toBe('İş')
    }
  })

  it('migrates a file that says it is an old one, even when it holds sites', () => {
    const migrated = migrateSiteSessionStateV1({
      version: 1,
      configVersion: 0,
      sites: {
        google: {
          accounts: {
            a1: {
              name: 'İş',
              enabled: true,
              importedAt: null,
              lastResult: null,
              lastError: null,
              fingerprints: []
            }
          },
          activeAccountId: 'a1'
        }
      }
    })
    expect(migrated.version).toBe(2)
    expect(migrated.sites).toEqual({})
  })

  it('keeps the fields of the old target that this build does not know', () => {
    const migrated = migrateSiteSessionStateV1({
      version: 1,
      configVersion: 0,
      targets: { google: { enabled: true, futureField: 'kept' } }
    })
    expect(migrated.sites.google.accounts.primary).toMatchObject({ futureField: 'kept' })
  })

  it('survives a file that is not an object', () => {
    for (const raw of [null, undefined, 'text', 42, []]) {
      expect(migrateSiteSessionStateV1(raw)).toEqual({
        version: 2,
        configVersion: 0,
        sites: {}
      })
    }
  })

  it('survives a file whose targets are missing or broken', () => {
    const withoutTargets = migrateSiteSessionStateV1({ version: 1, configVersion: 3 })
    expect(withoutTargets).toEqual({ version: 2, configVersion: 3, sites: {} })

    const brokenTarget = migrateSiteSessionStateV1({
      version: 1,
      configVersion: 0,
      targets: { google: 'not an object' }
    })
    expect(brokenTarget.sites.google.accounts.primary).toEqual({
      name: null,
      enabled: false,
      importedAt: null,
      lastResult: null,
      lastError: null,
      fingerprints: []
    })
  })
})

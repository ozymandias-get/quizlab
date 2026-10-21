/**
 * The migration of the session state file from the site-level shape to the
 * account-level one.
 *
 * The old file held one entry per site (`targets`); the new one holds one
 * entry per site with the accounts of that site (`sites`). Every site of the
 * old file becomes a site with a single **primary** account that keeps the
 * old values, so the switch of the user keeps meaning the same thing.
 *
 * The module is pure: it reads no clock, no disk and no session. It only
 * turns what has been read into what will be written.
 */

import { PRIMARY_ACCOUNT_ID } from '../../../shared/types/siteSession.js'

/** The format version the migration writes. */
const MIGRATED_VERSION = 2

/** How many fingerprints an account keeps: the newest ones. */
const MAX_FINGERPRINTS = 5

/**
 * The keys a state file may not carry, mirroring `ConfigManager`'s guard.
 *
 * Exported so that the config guards the ids it writes with the same set
 * instead of keeping a second copy of the rule.
 */
export const PROHIBITED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** The last results an import can report. */
const LAST_RESULTS: ReadonlySet<string> = new Set([
  'imported',
  'no_cookies',
  'permission_missing',
  'failed'
])

export interface SiteSessionAccountState {
  name: string | null
  enabled: boolean
  importedAt: string | null
  lastResult: 'imported' | 'no_cookies' | 'permission_missing' | 'failed' | null
  lastError: string | null
  fingerprints: string[]
}

export interface SiteSessionSiteState {
  accounts: Record<string, SiteSessionAccountState>
  activeAccountId: string | null
}

export interface SiteSessionConfigFile {
  version: number
  configVersion: number
  sites: Record<string, SiteSessionSiteState>
}

/** Whether a value is an object whose fields may be read one by one. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether a value is one of the outcomes an import can report. */
function isLastResult(value: unknown): value is SiteSessionAccountState['lastResult'] {
  return typeof value === 'string' && LAST_RESULTS.has(value)
}

/**
 * A number a file may hold: a number, or a string that holds one.
 *
 * A file that was edited by hand may hold `"3"` where a `3` belongs; it
 * still means three. A value that is not a number at all is `NaN`, and the
 * caller decides what it means.
 */
function readNumber(value: unknown): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/**
 * The version of a file as a number, or null when it does not hold one.
 *
 * A version written as a string is read here for the number that is written
 * back when the file is kept, but it does not decide which format the file is
 * in - only a number does; see `isMigratedFile`.
 */
function readVersion(value: unknown): number | null {
  const parsed = readNumber(value)
  if (!Number.isFinite(parsed)) return null
  return Math.floor(parsed)
}

/**
 * Whether a version is a number.
 *
 * Only a number is authoritative: it says which format the file is in. A
 * version written as a string, or one that was hand-edited into nonsense,
 * says nothing about the format; the shape of the file decides instead.
 */
function isNumericVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * The counter the extension polls.
 *
 * The counter is clamped, not zeroed: a file that holds `"3"` as a string
 * still counts as three, so the next write does not move it backwards.
 */
function normalizeConfigVersion(value: unknown): number {
  const parsed = readNumber(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

/** Whether an old-shape `targets` dictionary holds a site that has to be migrated. */
function hasTargets(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0
}

/**
 * Whether the file is already in the new shape.
 *
 * A version that is a number is believed: it says which format the file is
 * in, and it alone decides. A version that is missing, written as a string
 * or hand-edited into nonsense says nothing, so the shape of the file
 * decides instead: one that holds `sites` and has no `targets` left to
 * migrate is a migrated file.
 *
 * The type of the version must not change what happens to the data on its
 * own: a version written as a string has no say at all, so it can neither
 * turn an old file into a migrated one nor the other way round - what the
 * file holds decides.
 *
 * Exported so that the config asks the migration itself whether a write is
 * needed, instead of keeping a second answer that can disagree with it.
 */
export function isMigratedFile(source: unknown): boolean {
  if (!isRecord(source)) return false
  if (isNumericVersion(source.version)) return Math.floor(source.version) >= MIGRATED_VERSION
  return isRecord(source.sites) && !hasTargets(source.targets)
}

/**
 * The old file, turned into the new one.
 *
 * A file that is already in the new shape is kept as it is: it was written by
 * a build that already knew the accounts, and migrating it again would throw
 * the accounts away. An old file loses nothing: every site of it becomes a
 * site with one primary account.
 */
export function migrateSiteSessionStateV1(raw: unknown): SiteSessionConfigFile {
  const source = isRecord(raw) ? raw : {}
  const version = readVersion(source.version)
  const configVersion = normalizeConfigVersion(source.configVersion)

  if (isMigratedFile(source)) {
    return {
      // A newer version is kept: this build must not pretend it understands
      // a format it does not know.
      version: version === null ? MIGRATED_VERSION : Math.max(MIGRATED_VERSION, version),
      configVersion,
      sites: readSites(source.sites)
    }
  }

  return {
    version: MIGRATED_VERSION,
    configVersion,
    sites: migrateTargets(source.targets)
  }
}

/**
 * The whole file in the new shape, with the fields this build does not know.
 *
 * The migration decides which sites the file has; the fields it does not
 * describe are copied over it one by one, so a newer build does not lose
 * them on the next write. The old `targets` dictionary is not one of them:
 * it belongs to the format that was just migrated and must not survive.
 */
export function readConfigFile(raw: unknown): SiteSessionConfigFile {
  const source = isRecord(raw) ? raw : {}
  const migrated = migrateSiteSessionStateV1(source)
  const fields = readUnknownFields(source)
  delete fields.targets

  return {
    ...fields,
    version: migrated.version,
    configVersion: migrated.configVersion,
    sites: migrated.sites
  }
}

/**
 * The sites of the old file, each with its primary account.
 *
 * Every site of the file is carried over, even one that is not in the
 * registry any more: the migration does not know the registry, and such a
 * site is invisible in the list anyway - it is dropped when the site itself
 * is forgotten.
 */
function migrateTargets(raw: unknown): Record<string, SiteSessionSiteState> {
  const sites: Record<string, SiteSessionSiteState> = {}
  if (!isRecord(raw)) return sites

  for (const [siteId, target] of Object.entries(raw)) {
    if (PROHIBITED_KEYS.has(siteId)) continue
    sites[siteId] = {
      accounts: { [PRIMARY_ACCOUNT_ID]: readPrimaryAccount(target) },
      activeAccountId: PRIMARY_ACCOUNT_ID
    }
  }
  return sites
}

/**
 * A copy of a source object without the keys a state file may not carry.
 *
 * The fields this build knows are written after this copy and win over it;
 * what is left is what a newer build may have added, kept so that the next
 * save does not lose it. A plain spread would copy an own `__proto__` key as
 * data, and the object would write that key back.
 */
function readUnknownFields(source: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (PROHIBITED_KEYS.has(key)) continue
    fields[key] = value
  }
  return fields
}

/**
 * The primary account of a site of the old file.
 *
 * The old values are copied one by one. The account has no name and no
 * fingerprint yet, because the old file held neither. The fields this build
 * does not know are kept, so that a file written by a newer build does not
 * lose them on the next write.
 */
function readPrimaryAccount(raw: unknown): SiteSessionAccountState {
  const source = isRecord(raw) ? raw : {}
  return {
    ...readUnknownFields(source),
    name: null,
    enabled: source.enabled === true,
    importedAt: typeof source.importedAt === 'string' ? source.importedAt : null,
    lastResult: isLastResult(source.lastResult) ? source.lastResult : null,
    lastError: typeof source.lastError === 'string' ? source.lastError : null,
    fingerprints: []
  }
}

/**
 * The sites of a file that is already in the new shape.
 *
 * The sites are kept as they are. Only the values that cannot be read are
 * repaired, so that a file edited by hand cannot put the app into a state
 * the rest of the feature cannot describe.
 */
function readSites(raw: unknown): Record<string, SiteSessionSiteState> {
  const sites: Record<string, SiteSessionSiteState> = {}
  if (!isRecord(raw)) return sites

  for (const [siteId, site] of Object.entries(raw)) {
    if (PROHIBITED_KEYS.has(siteId)) continue
    sites[siteId] = readSite(site)
  }
  return sites
}

/** One site of a file that is already in the new shape. */
function readSite(raw: unknown): SiteSessionSiteState {
  const source = isRecord(raw) ? raw : {}
  const accounts: Record<string, SiteSessionAccountState> = {}

  if (isRecord(source.accounts)) {
    for (const [accountId, account] of Object.entries(source.accounts)) {
      if (PROHIBITED_KEYS.has(accountId)) continue
      accounts[accountId] = readAccount(account)
    }
  }

  return {
    ...readUnknownFields(source),
    accounts,
    activeAccountId: readActiveAccountId(source.activeAccountId, accounts)
  }
}

/**
 * The active account of a site.
 *
 * A file that names an account the site does not have is repaired: the site
 * has no active account until one is picked, and a dangling id would send
 * the app after an account that does not exist.
 */
function readActiveAccountId(
  value: unknown,
  accounts: Record<string, SiteSessionAccountState>
): string | null {
  if (typeof value !== 'string') return null
  // `Object.hasOwn` keeps prototype-chain ids ('constructor', '__proto__', …)
  // from resolving to an inherited member of the accounts.
  return Object.hasOwn(accounts, value) ? value : null
}

/** One account of a file that is already in the new shape. */
function readAccount(raw: unknown): SiteSessionAccountState {
  const source = isRecord(raw) ? raw : {}
  return {
    ...readUnknownFields(source),
    name: typeof source.name === 'string' && source.name !== '' ? source.name : null,
    enabled: source.enabled === true,
    importedAt: typeof source.importedAt === 'string' ? source.importedAt : null,
    lastResult: isLastResult(source.lastResult) ? source.lastResult : null,
    lastError: typeof source.lastError === 'string' ? source.lastError : null,
    fingerprints: readFingerprints(source.fingerprints)
  }
}

/** The fingerprints of an account: the digests that tell accounts apart. */
function readFingerprints(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((entry): entry is string => typeof entry === 'string').slice(-MAX_FINGERPRINTS)
}

/**
 * The account's history with one more fingerprint, capped at the newest five.
 *
 * A fingerprint that is already in the history is not added again: a token
 * that renews with the same value would otherwise fill the history with
 * copies of itself and evict a distinct older one.
 */
export function addFingerprint(history: readonly string[], fingerprint: string): string[] {
  if (history.includes(fingerprint)) return history.slice(-MAX_FINGERPRINTS)
  return [...history, fingerprint].slice(-MAX_FINGERPRINTS)
}

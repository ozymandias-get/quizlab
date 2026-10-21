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

/** The keys a state file may not carry, mirroring `ConfigManager`'s guard. */
const PROHIBITED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

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

function isLastResult(value: unknown): value is SiteSessionAccountState['lastResult'] {
  return typeof value === 'string' && LAST_RESULTS.has(value)
}

/**
 * The format version of a file.
 *
 * A file that does not say which version it is is an old one: it is migrated.
 * A newer version is kept, because this build must not pretend it understands
 * a format it does not know.
 */
function readFormatVersion(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(parsed)) return 1
  return Math.floor(parsed)
}

/**
 * The counter the extension polls.
 *
 * The counter is clamped, not zeroed: a file that holds `"3"` as a string
 * still counts as three, so the next write does not move it backwards.
 */
function normalizeConfigVersion(value: unknown): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
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
  const version = readFormatVersion(source.version)
  const configVersion = normalizeConfigVersion(source.configVersion)

  if (version >= MIGRATED_VERSION) {
    return {
      version,
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
 * The primary account of a site of the old file.
 *
 * The old values are copied one by one. The account has no name and no
 * fingerprint yet, because the old file held neither.
 */
function readPrimaryAccount(raw: unknown): SiteSessionAccountState {
  const source = isRecord(raw) ? raw : {}
  return {
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
    ...source,
    accounts,
    activeAccountId: typeof source.activeAccountId === 'string' ? source.activeAccountId : null
  }
}

/** One account of a file that is already in the new shape. */
function readAccount(raw: unknown): SiteSessionAccountState {
  const source = isRecord(raw) ? raw : {}
  return {
    ...source,
    name: typeof source.name === 'string' ? source.name : null,
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
  return raw.filter((entry): entry is string => typeof entry === 'string')
}

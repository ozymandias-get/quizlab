/**
 * The accounts of a site: one row per account, each with its own cookie jar.
 *
 * A site always has a primary account, even when the user never touched it. It
 * lives in the platform's own partition, the one the site has always used, so
 * the login the user typed there by hand keeps working. An additional account
 * gets a partition of its own instead: two accounts of one site must never
 * share a partition, or they would see each other's session.
 */

import { PRIMARY_ACCOUNT_ID, type SiteSessionKind } from '../../../shared/types/siteSession.js'
import { getSiteSessionConfig } from './siteSessionConfig.js'
import type { SiteSessionAccountState, SiteSessionConfigFile } from './siteSessionMigration.js'
import { buildSiteSessionTargets, type SiteSessionTargetRow } from './siteSessionTargets.js'

/** One account of a site: what the settings list and the routing need to draw it. */
export interface SiteSessionAccountRow {
  siteId: string
  accountId: string
  labelKey: string
  kind: SiteSessionKind
  hostname: string
  memberAppIds: string[]
  origins: readonly string[]
  cookieDomains: readonly string[]
  /** The partition this account's session lives in. */
  partition: string
  /** The account's persisted state. */
  state: SiteSessionAccountState
  isPrimary: boolean
}

/** Whether the id names the account every site owns. */
export function isPrimaryAccount(accountId: string): boolean {
  return accountId === PRIMARY_ACCOUNT_ID
}

/**
 * The partition of an additional account.
 *
 * The id is sanitised because a site id may carry a colon (`custom:custom_…`)
 * and a partition name is used as a folder name: only word characters and
 * dashes survive the cache whitelist and the path rules. The primary account
 * never uses this: it keeps the platform's partition.
 */
export function accountPartitionFor(siteId: string, accountId: string): string {
  return `persist:ai_${siteId.replaceAll(/[^A-Za-z0-9_-]/g, '_')}_${accountId}`
}

/** An account that was never touched: unnamed, off, no history. */
function createEmptyAccountState(): SiteSessionAccountState {
  return {
    name: null,
    enabled: false,
    importedAt: null,
    lastResult: null,
    lastError: null,
    fingerprints: []
  }
}

/**
 * One row of a site, with the partition the account lives in.
 *
 * The primary account keeps the partition of the site; every other account
 * derives one from the site and account ids. The member app ids are copied so
 * a caller cannot mutate the target through the row.
 */
function buildAccountRow(
  site: SiteSessionTargetRow,
  accountId: string,
  state: SiteSessionAccountState
): SiteSessionAccountRow {
  const isPrimary = isPrimaryAccount(accountId)
  return {
    siteId: site.siteId,
    accountId,
    labelKey: site.labelKey,
    kind: site.kind,
    hostname: site.hostname,
    memberAppIds: [...site.memberAppIds],
    origins: site.origins,
    cookieDomains: site.cookieDomains,
    partition: isPrimary ? site.partition : accountPartitionFor(site.siteId, accountId),
    state,
    isPrimary
  }
}

/**
 * The account rows of every site.
 *
 * A site without a state has never been touched by the user; it still has its
 * primary account, off, on the platform's partition. A site with a state
 * contributes the accounts the file holds: the primary first, then the
 * additional accounts in the order they were added.
 */
export function buildAccountRows(
  sites: readonly SiteSessionTargetRow[],
  state: SiteSessionConfigFile
): SiteSessionAccountRow[] {
  const rows: SiteSessionAccountRow[] = []

  for (const site of sites) {
    const accounts = state.sites[site.siteId]?.accounts
    if (!accounts || Object.keys(accounts).length === 0) {
      rows.push(buildAccountRow(site, PRIMARY_ACCOUNT_ID, createEmptyAccountState()))
      continue
    }

    if (Object.hasOwn(accounts, PRIMARY_ACCOUNT_ID)) {
      rows.push(buildAccountRow(site, PRIMARY_ACCOUNT_ID, accounts[PRIMARY_ACCOUNT_ID]))
    }
    for (const [accountId, accountState] of Object.entries(accounts)) {
      if (accountId === PRIMARY_ACCOUNT_ID) continue
      rows.push(buildAccountRow(site, accountId, accountState))
    }
  }

  return rows
}

/**
 * The partition the panel of a site must open.
 *
 * The active account decides; a site without one (or one whose active account
 * is not in the file any more) has no partition to offer, and the caller falls
 * back to the platform's own.
 */
export async function resolveActiveAccountPartition(siteId: string): Promise<string | null> {
  const [targets, state] = await Promise.all([
    buildSiteSessionTargets(),
    getSiteSessionConfig().read()
  ])
  const activeAccountId = state.sites[siteId]?.activeAccountId
  if (!activeAccountId) return null

  const rows = buildAccountRows(targets, state)
  return (
    rows.find((row) => row.siteId === siteId && row.accountId === activeAccountId)?.partition ??
    null
  )
}

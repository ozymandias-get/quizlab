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
import { registerAccountPartition } from '../../app/window/permissionPolicy.js'
import { registerDynamicPartition } from '../../core/cacheRegistry.js'
import { createAccountState, getSiteSessionConfig } from './siteSessionConfig.js'
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

/** The characters a partition name may carry; everything else becomes `_`. */
function sanitizePartitionPart(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_-]/g, '_')
}

/**
 * The partition of an additional account.
 *
 * Both ids are sanitised: a site id may carry a colon (`custom:custom_…`) and
 * an account id may come from a hand-edited file, while a partition name is
 * used as a folder name and has to match the cache whitelist
 * (`persist:ai_[\w-]+`). The primary account never uses this: it keeps the
 * platform's partition.
 */
export function accountPartitionFor(siteId: string, accountId: string): string {
  return `persist:ai_${sanitizePartitionPart(siteId)}_${sanitizePartitionPart(accountId)}`
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
 * Every site carries a primary account, even when the user never touched it:
 * when the state has none — no entry at all, or one that holds only additional
 * accounts — the primary is synthesised off and on the platform's partition.
 * The primary comes first; the additional accounts follow in the order they
 * were added.
 */
export function buildAccountRows(
  sites: readonly SiteSessionTargetRow[],
  state: SiteSessionConfigFile
): SiteSessionAccountRow[] {
  const rows: SiteSessionAccountRow[] = []

  for (const site of sites) {
    const accounts = state.sites[site.siteId]?.accounts
    const primaryState =
      accounts && Object.hasOwn(accounts, PRIMARY_ACCOUNT_ID)
        ? accounts[PRIMARY_ACCOUNT_ID]
        : createAccountState(false)
    rows.push(buildAccountRow(site, PRIMARY_ACCOUNT_ID, primaryState))
    if (!accounts) continue

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

/**
 * Registers one account partition with the policy, the cache registry and its
 * session, in that order.
 *
 * The account module owns which partition an account gets; the session setup
 * stays injected so this module does not import the window layer. The caller
 * that creates an account at runtime (the bridge or the service) and the
 * startup registration share this so the two cannot drift.
 */
export function registerAccountPartitionFor(
  site: Pick<SiteSessionTargetRow, 'siteId' | 'origins'>,
  accountId: string,
  setupSession: (partition: string) => void
): void {
  const partition = accountPartitionFor(site.siteId, accountId)

  for (const origin of site.origins) {
    registerAccountPartition(partition, origin)
  }
  registerDynamicPartition(partition)
  setupSession(partition)
}

/**
 * Opens the session of every additional account the state files hold.
 *
 * A partition the app minted for an account is unknown to the permission
 * policy and the cache registry until it is registered here: the panel refuses
 * a view whose partition is unregistered, and the cache sweeper would leave
 * the account's cache unswept. Because the accounts are the user's, the
 * partitions are dynamic — they are registered at start-up from the persisted
 * state, not from a static list.
 *
 * The primary account is skipped: it keeps the partition its platform always
 * used, which the registry-derived path already registers and configures.
 *
 * The session setup is injected by the caller: this module owns the account
 * model and the window layer owns session configuration, and importing one
 * from the other would close a cycle between the two.
 */
export async function registerSiteSessionPartitions(
  setupSession: (partition: string) => void
): Promise<void> {
  const [targets, state] = await Promise.all([
    buildSiteSessionTargets(),
    getSiteSessionConfig().read()
  ])

  for (const row of buildAccountRows(targets, state)) {
    if (row.isPrimary) continue
    registerAccountPartitionFor(row, row.accountId, setupSession)
  }
}

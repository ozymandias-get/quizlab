/**
 * The renderer-facing side of the per-site session import.
 *
 * The settings page asks this service which sites exist and what state their
 * accounts are in, and it carries out the user's actions on one account at a
 * time. The service answers and acts; the rules about what may be imported
 * live in the bridge core, the rules about the state live in the config, and
 * the rules about what a wipe touches live in the wipe.
 *
 * Three rules matter here:
 *
 *   - Turning an account's switch off writes the switch *first* and wipes the
 *     session afterwards, both under the lock of that account, so that the
 *     account is signed out again. An import into the same account waits for
 *     the wipe and cannot undo it, and a packet that arrives after the switch
 *     was written is refused by the bridge core, which reads the switch once
 *     more right before it writes a cookie.
 *   - A switch that could not be written is reported as a failure. The app
 *     must not tell the user that an account was switched off while it is
 *     still importing it.
 *   - The account is the unit of every action: the settings page lists the
 *     accounts of a site, and every action names the account it acts on.
 */

import type { Session } from 'electron'
import { session as electronSession } from 'electron'

import type {
  SiteSessionAccountView,
  SiteSessionActionResult,
  SiteSessionListResult,
  SiteSessionSiteView
} from '../../../shared/types/siteSession.js'
import { unregisterAccountPartition } from '../../app/window/permissionPolicy.js'
import { unregisterDynamicPartition } from '../../core/cacheRegistry.js'
import { Logger } from '../../core/logger.js'
import { nativeMessagingManager } from '../native-messaging/nativeMessagingManager.js'
import type { SiteSessionAccountRegistrar } from './siteSessionAccountRegistration.js'
import { registerRuntimeAccount } from './siteSessionAccountRegistration.js'
import {
  accountPartitionFor,
  buildAccountRows,
  isPrimaryAccount,
  type SiteSessionAccountRow
} from './siteSessionAccounts.js'
import {
  hasLocalSessionForTarget,
  importIntoAccount,
  SITE_SESSION_PROTOCOL_VERSION
} from './siteSessionBridge.js'
import { getSiteSessionConfig, type SiteSessionConfig } from './siteSessionConfig.js'
import {
  invalidateSiteSessionListCache,
  readCachedSiteSessionList,
  writeCachedSiteSessionList
} from './siteSessionListCache.js'
import { withSiteSessionLock } from './siteSessionLock.js'
import type { SiteSessionConfigFile } from './siteSessionMigration.js'
import { removePartitionDirectory } from './siteSessionPartitions.js'
import { clearPendingSiteSession, getPendingSiteSession } from './siteSessionPendingSessions.js'
import { deriveSiteSessionStatus } from './siteSessionStatus.js'
import { buildSiteSessionTargets, type SiteSessionTargetRow } from './siteSessionTargets.js'
import { wipeSiteSession } from './siteSessionWipe.js'

/**
 * The parts of the app the service works with.
 *
 * They are injected so that the service can be tested without touching the
 * user's real sessions, and so that the caller that owns the state decides
 * where it is read from.
 */
export interface SiteSessionServiceDeps {
  config: Pick<
    SiteSessionConfig,
    | 'read'
    | 'setEnabled'
    | 'setActiveAccount'
    | 'setAttributedAccount'
    | 'renameAccount'
    | 'deleteAccount'
    | 'createAccount'
    | 'recordResult'
  >
  loadTargets: () => Promise<SiteSessionTargetRow[]>
  resolveSession: (partition: string) => Session
  isExtensionConnected: () => boolean
  isExtensionVersionOk: () => boolean
  /**
   * Registers the partition of an account the service opens.
   *
   * The account is created after start-up, so its partition is not in the
   * policy or the cache registry yet. The registrar comes from the caller
   * because the window layer owns sessions and permissions.
   */
  registerAccount: SiteSessionAccountRegistrar
}

export class SiteSessionService {
  private readonly deps: SiteSessionServiceDeps

  constructor(deps: SiteSessionServiceDeps) {
    this.deps = deps
  }

  /**
   * The sites, their accounts and their states.
   *
   * The partition of an account never leaves this method: the renderer gets
   * the label, the hostname, the accounts and their states — nothing that
   * would let it address a session of its own.
   *
   * The answer is kept for a couple of seconds: the settings page and the
   * button in the bottom bar ask for the list at the same time, and building
   * it reads the session of every account. The cache is dropped by everything
   * that changes the answer — an account action, an import.
   */
  async list(): Promise<SiteSessionListResult> {
    const cached = readCachedSiteSessionList()
    if (cached) return cached

    const list = await this.buildList()
    writeCachedSiteSessionList(list)
    return list
  }

  /** The list of the sites, read from the state and from the sessions. */
  private async buildList(): Promise<SiteSessionListResult> {
    const [targets, state] = await Promise.all([this.deps.loadTargets(), this.deps.config.read()])
    const extensionConnected = this.deps.isExtensionConnected()
    const extensionVersionOk = this.deps.isExtensionVersionOk()
    const rows = buildAccountRows(targets, state)

    // Every site answers with the accounts it holds.
    const accountViews = await Promise.all(
      targets.map((target): Promise<SiteSessionSiteView> =>
        this.buildSiteView(target, rows, state, extensionConnected, extensionVersionOk)
      )
    )

    return {
      accountViews,
      extensionConnected,
      extensionVersionOk
    }
  }

  /** One site with the view of every account it holds. */
  private async buildSiteView(
    target: SiteSessionTargetRow,
    rows: readonly SiteSessionAccountRow[],
    state: SiteSessionConfigFile,
    extensionConnected: boolean,
    extensionVersionOk: boolean
  ): Promise<SiteSessionSiteView> {
    const siteState = state.sites[target.siteId]
    const activeAccountId = siteState?.activeAccountId ?? null
    const attributedAccountId = siteState?.attributedAccountId ?? null

    const siteRows = rows.filter((row) => row.siteId === target.siteId)
    const accounts = await Promise.all(
      siteRows.map(async (row, index): Promise<SiteSessionAccountView> => {
        const hasLocalSession = await hasLocalSessionForTarget(row, this.deps.resolveSession)
        return {
          accountId: row.accountId,
          name: row.state.name,
          index: index + 1,
          enabled: row.state.enabled,
          status: deriveSiteSessionStatus({
            enabled: row.state.enabled,
            extensionConnected,
            extensionVersionOk,
            lastResult: row.state.lastResult,
            hasLocalSession
          }),
          importedAt: row.state.importedAt,
          lastError: row.state.lastError,
          isActive: activeAccountId === row.accountId,
          isPrimary: isPrimaryAccount(row.accountId)
        }
      })
    )

    return {
      siteId: target.siteId,
      labelKey: target.labelKey,
      hostname: target.hostname,
      kind: target.kind,
      memberAppIds: [...target.memberAppIds],
      accounts,
      activeAccountId,
      attributedAccountId,
      hasPendingSession: getPendingSiteSession(target.siteId) !== null
    }
  }

  /**
   * Turns the import of one account on or off.
   *
   * Switching it on writes the switch and nothing else: no cookie is written
   * by the app, the extension pushes the session within its next round.
   *
   * Switching it off writes the switch first and wipes the session after it:
   * the account has to be signed in again the next time it is used. Both run
   * under the lock of the account, so an import that is already running
   * finishes before the wipe and cannot undo it.
   */
  async setEnabled(
    siteId: string,
    accountId: string,
    enabled: boolean
  ): Promise<SiteSessionActionResult> {
    // The switch changes what the list shows, so the list that is kept is
    // dropped before anything is written.
    invalidateSiteSessionListCache()

    const row = await this.findAccount(siteId, accountId)
    if (!row) return { success: false, error: 'unknown_target' }

    if (enabled) {
      try {
        await this.deps.config.setEnabled(siteId, accountId, true)
      } catch (error) {
        // The switch was not written. Reporting a success here would tell the
        // user that an account was switched on while the app never heard of it.
        Logger.warn(`[SiteSession] The switch of "${accountId}" could not be written:`, error)
        return { success: false, error: 'write_failed' }
      }
      return { success: true }
    }

    return withSiteSessionLock(siteId, accountId, () => this.switchOff(row))
  }

  /**
   * Forgets the session of one account without touching its switch.
   *
   * This is the "I sign in myself" path: the account keeps its place in the
   * settings, only the session the app holds for it is gone. The wipe runs
   * under the lock of the account, for the same reason the switch-off does.
   */
  async clear(siteId: string, accountId: string): Promise<SiteSessionActionResult> {
    // The session that is forgotten changes what the list shows, so the list
    // that is kept is dropped before the wipe starts.
    invalidateSiteSessionListCache()

    const row = await this.findAccount(siteId, accountId)
    if (!row) return { success: false, error: 'unknown_target' }

    return withSiteSessionLock(siteId, accountId, async () => {
      try {
        await this.wipe(row)
      } catch (error) {
        Logger.warn(`[SiteSession] The session of "${accountId}" could not be cleared:`, error)
        return { success: false, error: 'wipe_failed' }
      }

      return { success: true }
    })
  }

  /**
   * Marks the account the panels of the site open with.
   *
   * No session is touched: the choice only changes which cookie jar the panel
   * uses, and the renderer rebuilds the panel when the list changes.
   */
  async setActiveAccount(siteId: string, accountId: string): Promise<SiteSessionActionResult> {
    invalidateSiteSessionListCache()

    const [targets, state] = await Promise.all([this.deps.loadTargets(), this.deps.config.read()])
    const row = buildAccountRows(targets, state).find(
      (entry) => entry.siteId === siteId && entry.accountId === accountId
    )
    if (!row) return { success: false, error: 'unknown_target' }

    const failure = await this.storeSyntheticAccount(row, state)
    if (failure) return failure

    try {
      await this.deps.config.setActiveAccount(siteId, accountId)
    } catch (error) {
      Logger.warn(`[SiteSession] The active account of "${siteId}" could not be written:`, error)
      return { success: false, error: 'write_failed' }
    }

    return { success: true }
  }

  /**
   * Gives an account the user's name for it.
   *
   * A name has to be unique inside its site: two rows with the same name would
   * make the account the user means unclear. The account may keep the name it
   * already has, and an empty name means "no name".
   */
  async renameAccount(
    siteId: string,
    accountId: string,
    name: string
  ): Promise<SiteSessionActionResult> {
    invalidateSiteSessionListCache()

    const [targets, state] = await Promise.all([this.deps.loadTargets(), this.deps.config.read()])
    const rows = buildAccountRows(targets, state)
    const row = rows.find((entry) => entry.siteId === siteId && entry.accountId === accountId)
    if (!row) return { success: false, error: 'unknown_target' }

    const normalizedName = name === '' ? null : name
    if (
      normalizedName !== null &&
      rows.some(
        (entry) =>
          entry.siteId === siteId &&
          entry.accountId !== accountId &&
          entry.state.name === normalizedName
      )
    ) {
      return { success: false, error: 'duplicate_name' }
    }

    const failure = await this.storeSyntheticAccount(row, state)
    if (failure) return failure

    try {
      await this.deps.config.renameAccount(siteId, accountId, name)
    } catch (error) {
      Logger.warn(`[SiteSession] The name of "${accountId}" could not be written:`, error)
      return { success: false, error: 'write_failed' }
    }

    return { success: true }
  }

  /**
   * Removes an additional account and everything it holds.
   *
   * The primary account cannot be deleted: it lives in the platform's own
   * partition, and its switch is the way to empty it. An additional account is
   * wiped, removed from the state and then taken off the disk, in that order:
   * the account is removed from the state even if the folder fails to delete,
   * while a wipe that failed leaves the account in place so the user can try again.
   */
  async deleteAccount(siteId: string, accountId: string): Promise<SiteSessionActionResult> {
    invalidateSiteSessionListCache()

    if (isPrimaryAccount(accountId)) return { success: false, error: 'primary_account' }

    const row = await this.findAccount(siteId, accountId)
    if (!row) return { success: false, error: 'unknown_target' }

    return withSiteSessionLock(siteId, accountId, async () => {
      try {
        await this.wipe(row)
      } catch (error) {
        Logger.warn(`[SiteSession] The session of "${accountId}" could not be cleared:`, error)
        return { success: false, error: 'wipe_failed' }
      }

      const state = await this.deps.config.read()
      const wasAttributed = state.sites[siteId]?.attributedAccountId === accountId

      try {
        await this.deps.config.deleteAccount(siteId, accountId)
      } catch (error) {
        Logger.warn(`[SiteSession] The account "${accountId}" could not be removed:`, error)
        return { success: false, error: 'write_failed' }
      }

      if (wasAttributed) {
        try {
          await this.deps.config.setAttributedAccount(siteId, null)
        } catch (error) {
          Logger.warn(`[SiteSession] The attribution of "${siteId}" could not be cleared:`, error)
        }
      }

      // The account is gone from the state: the running process must stop
      // trusting its partition at once, even if the folder refuses to go.
      unregisterAccountPartition(row.partition)
      unregisterDynamicPartition(row.partition)

      try {
        await removePartitionDirectory(row.partition)
      } catch (error) {
        Logger.warn(`[SiteSession] The data folder of "${accountId}" could not be removed:`, error)
        // The account itself was removed; only its folder stayed behind. The
        // renderer shows this as information, not as a failed deletion.
        return { success: false, error: 'folder_delete_failed' }
      }

      return { success: true }
    })
  }

  /**
   * Remembers the account an identity-less session was attributed to.
   *
   * An empty id or null clears the attribution so the next push asks the
   * user again.
   */
  async setAttributedAccount(
    siteId: string,
    accountId: string | null
  ): Promise<SiteSessionActionResult> {
    if (typeof siteId !== 'string' || siteId.length < 2) {
      return { success: false, error: 'invalid_arguments' }
    }
    if (accountId !== null && (typeof accountId !== 'string' || accountId.length < 2)) {
      return { success: false, error: 'invalid_arguments' }
    }

    const [target, state] = await Promise.all([this.findTarget(siteId), this.deps.config.read()])
    if (!target) return { success: false, error: 'invalid_arguments' }

    const site = state.sites[siteId]
    if (accountId !== null && (!site || !Object.hasOwn(site.accounts, accountId))) {
      return { success: false, error: 'invalid_arguments' }
    }

    try {
      await this.deps.config.setAttributedAccount(siteId, accountId)
    } catch (error) {
      Logger.warn(`[SiteSession] The attribution of "${siteId}" could not be written:`, error)
      return { success: false, error: 'write_failed' }
    }

    return { success: true }
  }

  /**
   * Writes a session the bridge could not attribute into an account.
   *
   * `accountId` is the account the user picked; null asks for a new one. A
   * selected account that is switched off is opened first: writing a session
   * into a closed account would undo the user's decision to cancel it. The
   * pending session is forgotten only once at least one cookie was written, so
   * a write that failed can be retried.
   */
  async resolvePendingSession(
    siteId: string,
    accountId: string | null
  ): Promise<SiteSessionActionResult> {
    const pending = getPendingSiteSession(siteId)
    if (!pending) return { success: false, error: 'unknown_target' }

    const target = await this.findTarget(siteId)
    if (!target) return { success: false, error: 'unknown_target' }

    const resolvedAccountId = accountId ?? crypto.randomUUID()

    return withSiteSessionLock(siteId, resolvedAccountId, async () => {
      let partition: string

      if (accountId === null) {
        try {
          await this.deps.config.createAccount(siteId, resolvedAccountId, null)
        } catch (error) {
          Logger.warn(
            `[SiteSession] The account "${resolvedAccountId}" could not be opened:`,
            error
          )
          return { success: false, error: 'write_failed' }
        }
        // The account is new in this process: register its partition before
        // anything opens or writes to it.
        this.deps.registerAccount(target, resolvedAccountId)
        partition = accountPartitionFor(siteId, resolvedAccountId)
      } else {
        const row = await this.findAccount(siteId, accountId)
        if (!row) return { success: false, error: 'unknown_target' }

        if (!row.state.enabled) {
          try {
            await this.deps.config.setEnabled(siteId, accountId, true)
          } catch (error) {
            Logger.warn(`[SiteSession] The switch of "${accountId}" could not be written:`, error)
            return { success: false, error: 'write_failed' }
          }
        }
        partition = row.partition
      }

      try {
        // The same import the bridge uses: it records the outcome on the
        // account row and forgets the pending session only once a cookie made
        // it into the jar.
        const outcome = await importIntoAccount(this.deps.config, this.deps.resolveSession, {
          siteRow: target,
          accountId: resolvedAccountId,
          partition,
          cookies: pending.cookies
        })
        if (!outcome.imported) {
          Logger.warn(`[SiteSession] None of the pending cookies of "${siteId}" could be written.`)
          return { success: false, error: 'import_failed' }
        }
      } catch (error) {
        Logger.warn(`[SiteSession] The pending session of "${siteId}" could not be written:`, error)
        await this.deps.config
          .recordResult(siteId, resolvedAccountId, 'failed', 'import_failed')
          .catch(() => {})
        return { success: false, error: 'import_failed' }
      }

      try {
        await this.deps.config.setAttributedAccount(siteId, resolvedAccountId)
      } catch (error) {
        Logger.warn(`[SiteSession] The attribution of "${siteId}" could not be written:`, error)
      }

      invalidateSiteSessionListCache()

      return { success: true }
    })
  }

  /** The target with this id, or null when the app does not know it. */
  private async findTarget(siteId: string): Promise<SiteSessionTargetRow | null> {
    const targets = await this.deps.loadTargets()
    return targets.find((target) => target.siteId === siteId) ?? null
  }

  /** The account of a site, with the partition its session lives in. */
  private async findAccount(
    siteId: string,
    accountId: string
  ): Promise<SiteSessionAccountRow | null> {
    const [targets, state] = await Promise.all([this.deps.loadTargets(), this.deps.config.read()])
    return (
      buildAccountRows(targets, state).find(
        (row) => row.siteId === siteId && row.accountId === accountId
      ) ?? null
    )
  }

  /**
   * Writes a primary account the file does not hold yet into the state.
   *
   * `buildAccountRows` always shows a primary, even on a site the user never
   * touched, while the config can only rename or mark an account the file
   * already holds. The two actions that need one call this first, so the
   * primary they show can actually be named and made active. The account is
   * written with its current switch, which is off for a synthetic primary, so
   * the config version does not move.
   */
  private async storeSyntheticAccount(
    row: SiteSessionAccountRow,
    state: SiteSessionConfigFile
  ): Promise<SiteSessionActionResult | null> {
    const accounts = state.sites[row.siteId]?.accounts ?? {}
    if (Object.hasOwn(accounts, row.accountId)) return null

    try {
      await this.deps.config.setEnabled(row.siteId, row.accountId, row.state.enabled)
      return null
    } catch (error) {
      Logger.warn(`[SiteSession] The account "${row.accountId}" could not be opened:`, error)
      return { success: false, error: 'write_failed' }
    }
  }

  /**
   * Turns the switch of an account off and wipes the session it held.
   *
   * The order is the invariant: the switch is written first, so a packet that
   * arrives while the wipe is running is refused, and the wipe runs last, so
   * the account ends up without a session.
   */
  private async switchOff(row: SiteSessionAccountRow): Promise<SiteSessionActionResult> {
    try {
      await this.deps.config.setEnabled(row.siteId, row.accountId, false)
    } catch (error) {
      // The switch was not written. Reporting a success here would tell the
      // user that an account was switched off while the app keeps importing it.
      Logger.warn(`[SiteSession] The switch of "${row.accountId}" could not be written:`, error)
      return { success: false, error: 'write_failed' }
    }

    // A pending session belongs to the state the site had before the switch.
    // Once the last account is off there is no account left the question could
    // be asked about, so the stale packet has to go with the switch.
    try {
      const state = await this.deps.config.read()
      const accounts = state.sites[row.siteId]?.accounts
      if (!accounts || !Object.values(accounts).some((account) => account.enabled)) {
        clearPendingSiteSession(row.siteId)
      }
    } catch (error) {
      Logger.warn(
        `[SiteSession] The pending session of "${row.siteId}" could not be checked:`,
        error
      )
    }

    try {
      await this.wipe(row)
    } catch (error) {
      // The switch *was* written: the account is switched off, but the session
      // it held is still there. Saying "failed" alone would hide that half of
      // the work was done.
      Logger.warn(`[SiteSession] The session of "${row.accountId}" could not be cleared:`, error)
      return { success: false, error: 'switch_off_wipe_failed' }
    }

    return { success: true }
  }

  /** Removes the session the app holds for one account. */
  private async wipe(row: SiteSessionAccountRow): Promise<void> {
    await wipeSiteSession(this.deps.resolveSession(row.partition), row)
  }
}

/**
 * Whether the Chrome extension is talking to the app.
 *
 * The extension connects over the bridge; while it does not, the app cannot
 * pull a session from it.
 */
function isExtensionConnected(): boolean {
  return nativeMessagingManager.getExtensionInfo().status === 'connected'
}

/**
 * Whether the extension speaks the protocol of this build.
 *
 * The extension names the protocol it speaks in every request it makes to the
 * bridge, and the manager remembers the last one it reported. An extension
 * that reports nothing is an extension the user has to reload: it may be an
 * old copy that predates the handshake, and it would sit there connected
 * without ever pushing a session.
 */
export function isExtensionVersionOk(): boolean {
  const reported = nativeMessagingManager.getExtensionProtocolVersion()
  return reported !== null && reported >= SITE_SESSION_PROTOCOL_VERSION
}

/** The service the app uses. */
export const siteSessionService = new SiteSessionService({
  config: getSiteSessionConfig(),
  loadTargets: buildSiteSessionTargets,
  resolveSession: (partition) => electronSession.fromPartition(partition),
  isExtensionConnected,
  isExtensionVersionOk,
  registerAccount: registerRuntimeAccount
})

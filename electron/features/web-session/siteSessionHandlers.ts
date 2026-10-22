/**
 * The IPC surface of the per-site session import.
 *
 * The settings page and the panel reach the sessions of a site through these
 * channels: the list of the sites, the account-level switch, wipe, active
 * account, rename, delete and pending-session actions. Every one of them comes
 * from the trusted main window and validates its payload before it reaches the
 * service.
 *
 * A payload that is not what the action needs is refused with
 * `{ success: false, error: 'invalid_arguments' }` and changes nothing: a
 * switch that was turned off by accident wipes the session of an account, and
 * an empty id names no account at all. A refused call never reaches the
 * service.
 *
 * The old site-level `setEnabled` and `clear` channels are gone: the settings
 * card reads the accounts of a site, and every action names the account it
 * acts on.
 *
 * After an action was carried out the fresh list is sent to the renderer, so
 * the row shows the new state without waiting for a poll.
 */

import { failure, type IpcResult, success } from '../../../shared/lib/typedIpc.js'
import { type SiteSessionActionResult } from '../../../shared/types/siteSession.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { broadcastSiteSessionsChanged, setSiteSessionListReader } from './siteSessionBroadcast.js'
import { siteSessionService } from './siteSessionService.js'

const { IPC_CHANNELS } = APP_CONFIG

/** The longest name an account may carry, in characters. */
const MAX_ACCOUNT_NAME_LENGTH = 64

let handlersRegistered = false

/** Whether the value can name a site or an account: a non-empty string. */
function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/** The answer every malformed payload gets; it names a stable code. */
function refusal(): IpcResult<SiteSessionActionResult> {
  return success({ success: false, error: 'invalid_arguments' })
}

/**
 * Runs one account-level action and tells the renderer that the list changed.
 *
 * Both ids are validated here, so no handler has to repeat the check and no
 * malformed payload can reach the service. The list is sent even when the
 * action failed: part of it may have been written before the failure, and the
 * row has to show what the app really holds.
 */
async function runAccountAction(
  siteId: unknown,
  accountId: unknown,
  action: (siteId: string, accountId: string) => Promise<SiteSessionActionResult>
): Promise<IpcResult<SiteSessionActionResult>> {
  if (!isId(siteId) || !isId(accountId)) return refusal()

  const result = await action(siteId, accountId)
  await broadcastSiteSessionsChanged()
  return success(result)
}

export function registerSiteSessionHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  // The broadcast module sends the fresh list to the renderer, and it does not
  // know how the list is built: the service owns the state of the sites, so
  // the service is the one that reads it.
  setSiteSessionListReader(() => siteSessionService.list())

  registerIpcHandler(
    IPC_CHANNELS.SITE_SESSION_LIST,
    async () => success(await siteSessionService.list()),
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.SITE_SESSION_SET_ACCOUNT_ENABLED,
    async (_event, siteId: unknown, accountId: unknown, enabled: unknown) => {
      // The switch is the dangerous half of the pair: a payload that lost its
      // flag must not turn an account off and wipe its session.
      if (typeof enabled !== 'boolean') return refusal()

      return runAccountAction(siteId, accountId, (site, account) =>
        siteSessionService.setEnabled(site, account, enabled)
      )
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.SITE_SESSION_CLEAR_ACCOUNT,
    async (_event, siteId: unknown, accountId: unknown) =>
      runAccountAction(siteId, accountId, (site, account) =>
        siteSessionService.clear(site, account)
      ),
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.SITE_SESSION_SET_ACTIVE_ACCOUNT,
    async (_event, siteId: unknown, accountId: unknown) =>
      runAccountAction(siteId, accountId, (site, account) =>
        siteSessionService.setActiveAccount(site, account)
      ),
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.SITE_SESSION_RENAME_ACCOUNT,
    async (_event, siteId: unknown, accountId: unknown, name: unknown) => {
      // A name is the user's own text for the account: it has to be a string
      // and it has to fit on the row of the settings list.
      if (typeof name !== 'string' || name.length > MAX_ACCOUNT_NAME_LENGTH) return refusal()

      return runAccountAction(siteId, accountId, (site, account) =>
        siteSessionService.renameAccount(site, account, name)
      )
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.SITE_SESSION_DELETE_ACCOUNT,
    async (_event, siteId: unknown, accountId: unknown) =>
      runAccountAction(siteId, accountId, (site, account) =>
        siteSessionService.deleteAccount(site, account)
      ),
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.SITE_SESSION_RESOLVE_PENDING,
    async (_event, siteId: unknown, accountId: unknown) => {
      // `null` asks for a new account; anything else has to name one.
      if (accountId !== null && !isId(accountId)) return refusal()
      if (!isId(siteId)) return refusal()

      const result = await siteSessionService.resolvePendingSession(siteId, accountId)
      await broadcastSiteSessionsChanged()
      return success(result)
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )
}

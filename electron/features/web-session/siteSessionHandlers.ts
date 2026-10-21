/**
 * The IPC surface of the per-site session import.
 *
 * Three channels reach the settings page: the list of the sites, the switch
 * of one site and the "forget this session" action. Every one of them comes
 * from the trusted main window and validates its payload before it reaches
 * the service.
 *
 * A payload that is not what the action needs is refused with a code of its
 * own — `invalid_site_id`, `invalid_enabled` — and changes nothing: a switch
 * that was turned off by accident wipes the session of a site.
 *
 * After a switch is turned or a session is cleared the fresh list is sent to
 * the renderer, so the row shows the new state without waiting for a poll.
 */

import { failure, success } from '../../../shared/lib/typedIpc.js'
import { PRIMARY_ACCOUNT_ID } from '../../../shared/types/siteSession.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { broadcastSiteSessionsChanged, setSiteSessionListReader } from './siteSessionBroadcast.js'
import { siteSessionService } from './siteSessionService.js'

const { IPC_CHANNELS } = APP_CONFIG

let handlersRegistered = false

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
    IPC_CHANNELS.SITE_SESSION_SET_ENABLED,
    async (_event, siteId: unknown, enabled: unknown) => {
      if (typeof siteId !== 'string' || siteId.length === 0) {
        return success({ success: false, error: 'invalid_site_id' })
      }
      // Only a real boolean may turn a site on or off. A malformed payload
      // must not reach the service: switching a site off wipes its session,
      // and a payload that lost its flag on the way must not destroy it.
      if (typeof enabled !== 'boolean') {
        return success({ success: false, error: 'invalid_enabled' })
      }

      // The old channel predates the accounts: its switch is the primary
      // account's switch, which is the one the old settings card shows.
      const result = await siteSessionService.setEnabled(siteId, PRIMARY_ACCOUNT_ID, enabled)
      // The list is sent even when the action failed: the switch may have been
      // written before the session could be cleared, and the row has to show
      // what the app really holds.
      await broadcastSiteSessionsChanged()
      return success(result)
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.SITE_SESSION_CLEAR,
    async (_event, siteId: unknown) => {
      if (typeof siteId !== 'string' || siteId.length === 0) {
        return success({ success: false, error: 'invalid_site_id' })
      }

      const result = await siteSessionService.clear(siteId, PRIMARY_ACCOUNT_ID)
      await broadcastSiteSessionsChanged()
      return success(result)
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )
}

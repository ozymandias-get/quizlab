/**
 * The IPC surface of the per-site session import.
 *
 * Three channels reach the settings page: the list of the sites, the switch
 * of one site and the "forget this session" action. Every one of them comes
 * from the trusted main window and validates its payload before it reaches
 * the service.
 *
 * After a switch is turned or a session is cleared the fresh list is sent to
 * the renderer, so the row shows the new state without waiting for a poll.
 */

import { BrowserWindow } from 'electron'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { toStrictBoolean } from '../../core/ipcPayloadGuards.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { Logger } from '../../core/logger.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { siteSessionService } from './siteSessionService.js'

const { IPC_CHANNELS } = APP_CONFIG

let handlersRegistered = false

/**
 * Sends the fresh list to every window.
 *
 * The list is built again instead of being patched: the state of a site can
 * have changed in more than one way — the switch, the last import or the
 * session the app holds — and the renderer should not have to know which.
 */
async function broadcastSiteSessionsChanged(): Promise<void> {
  try {
    const result = await siteSessionService.list()
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed() || win.webContents.isDestroyed()) continue
      win.webContents.send(IPC_CHANNELS.SITE_SESSION_CHANGED, result)
    }
  } catch (error) {
    Logger.warn('[SiteSession] The changed list could not be sent:', error)
  }
}

export function registerSiteSessionHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

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

      const result = await siteSessionService.setEnabled(siteId, toStrictBoolean(enabled))
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

      const result = await siteSessionService.clear(siteId)
      await broadcastSiteSessionsChanged()
      return success(result)
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )
}

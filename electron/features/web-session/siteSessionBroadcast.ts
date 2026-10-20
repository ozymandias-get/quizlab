/**
 * Telling the renderer that the state of the sites changed.
 *
 * The module knows nothing about the sites themselves: whoever owns the state
 * registers a reader, and every notification asks it for the fresh list. That
 * keeps the module free of the service and of the bridge — the bridge calls
 * it after an import, and a module the bridge may import must not import the
 * bridge back.
 */

import { BrowserWindow } from 'electron'

import type { SiteSessionListResult } from '../../../shared/types/siteSession.js'
import { APP_CONFIG } from '../../app/constants.js'
import { Logger } from '../../core/logger.js'

/** Reads the current state of the sites. */
export type SiteSessionListReader = () => Promise<SiteSessionListResult>

let listReader: SiteSessionListReader | null = null

/**
 * Registers the reader that builds the fresh list.
 *
 * There is one reader: the module that owns the state of the sites is the
 * only one that can build the list.
 */
export function setSiteSessionListReader(reader: SiteSessionListReader): void {
  listReader = reader
}

/**
 * Sends the fresh list to every window.
 *
 * The list is built again instead of being patched: the state of a site can
 * have changed in more than one way — the switch, the last import or the
 * session the app holds — and the renderer should not have to know which.
 *
 * A list that cannot be built is not sent: the row then keeps the state it
 * had, and the next change sends a fresh one again.
 */
export async function broadcastSiteSessionsChanged(): Promise<void> {
  if (!listReader) return

  try {
    const result = await listReader()
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed() || win.webContents.isDestroyed()) continue
      win.webContents.send(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CHANGED, result)
    }
  } catch (error) {
    Logger.warn('[SiteSession] The changed list could not be sent:', error)
  }
}

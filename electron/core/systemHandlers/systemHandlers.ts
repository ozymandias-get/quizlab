/**
 * The system IPC surface that is not cache, clipboard or logging: quitting the
 * app and opening an external URL.
 *
 * The heavier domains register from their own modules; this file owns the
 * ordering and the once-per-process guard that keeps a hot reload from
 * double-registering a channel.
 */
import { app, ipcMain, shell } from 'electron'

import { success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { runCleanup } from '../appCleanup.js'
import { requireTrustedIpcSender } from '../ipcSecurity.js'
import { Logger, pushToLoggerBuffer } from '../logger.js'
import { registerCacheHandlers } from './cacheHandlers.js'
import { registerClipboardHandlers } from './clipboardHandlers.js'
import { resolveExternalLink } from './externalLinkPolicy.js'

const { IPC_CHANNELS } = APP_CONFIG

let handlersRegistered = false

export function registerSystemHandlers() {
  if (handlersRegistered) return
  handlersRegistered = true

  registerIpcHandler(
    IPC_CHANNELS.APP_QUIT,
    async () => {
      await runCleanup()

      setImmediate(() => {
        app.quit()
      })

      return success(true)
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.OPEN_EXTERNAL,
    async (_event, url: string) => {
      const decision = resolveExternalLink(url)
      if (!decision.allowed) {
        if (decision.reason === 'unparsable') {
          Logger.error('[IPC] External link error:', decision.parseError)
        }
        return success(false)
      }

      try {
        await shell.openExternal(decision.url)
        return success(true)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        Logger.error(`[IPC] External link error:`, message)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerCacheHandlers()

  // Logger forwarding from renderer (trusted-sender only)
  ipcMain.on(
    IPC_CHANNELS.LOGGER_LOG,
    (event, payload: { level: string; message: string; timestamp?: string }) => {
      if (!requireTrustedIpcSender(event)) return
      pushToLoggerBuffer(
        payload.level as 'trace' | 'debug' | 'info' | 'warn' | 'error',
        payload.message,
        payload.timestamp
      )
    }
  )

  registerClipboardHandlers()
}

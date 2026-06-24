import type { GeminiWebSessionStatus } from '@shared-core/types'

import { BrowserWindow, dialog } from 'electron'

import {
  GOOGLE_WEB_SESSION_APPS,
  type GoogleWebSessionAppId
} from '../../../shared/constants/google-ai-web-apps.js'
import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { toStrictBoolean } from '../../core/ipcPayloadGuards.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { Logger } from '../../core/logger.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { geminiWebSessionManager } from './sessionManager.js'

let handlersRegistered = false

/**
 * Broadcast the current Gemini Web Session status to ALL open BrowserWindows.
 * This keeps multi-window and split-screen UIs synchronised when state changes
 * (enabled/disabled, enabled apps, etc.) from one window.
 */
function broadcastStatus(status?: GeminiWebSessionStatus): void {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length === 0) return

  // Fetch fresh status if not provided (avoids a second IPC round-trip
  // when the caller already has it).
  const promise = status ? Promise.resolve(status) : geminiWebSessionManager.getStatus()

  void promise.then((s) => {
    for (const win of allWindows) {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(APP_CONFIG.IPC_CHANNELS.GEMINI_WEB_STATUS_UPDATED, s)
      }
    }
  })
}

export function registerGeminiWebSessionHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.GEMINI_WEB_STATUS,
    async () => {
      const status = await geminiWebSessionManager.getStatus()
      return status ? success(status) : failure('not_found', 'Status not available')
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.GEMINI_WEB_OPEN_LOGIN,
    async () => {
      return success(await geminiWebSessionManager.openLogin())
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.GEMINI_WEB_CHECK_NOW,
    async () => {
      return success(await geminiWebSessionManager.checkNow())
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.GEMINI_WEB_REAUTH,
    async () => {
      return success(await geminiWebSessionManager.reauthenticate())
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.GEMINI_WEB_RESET_PROFILE,
    async () => {
      return success(await geminiWebSessionManager.resetProfile())
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.GEMINI_WEB_SET_ENABLED,
    async (event, enabled: unknown) => {
      const result = await geminiWebSessionManager.setEnabled(toStrictBoolean(enabled))
      broadcastStatus(result.status)
      return success(result)
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.GEMINI_WEB_SET_ENABLED_APPS,
    async (event, enabledAppIds: unknown) => {
      if (!Array.isArray(enabledAppIds)) return success({ success: false, error: 'Unauthorized' })
      const valid: GoogleWebSessionAppId[] = []
      const validSet = new Set<string>(GOOGLE_WEB_SESSION_APPS.map((a) => a.id))
      for (const appId of enabledAppIds) {
        if (typeof appId === 'string' && validSet.has(appId)) {
          valid.push(appId as GoogleWebSessionAppId)
        }
      }

      const result = await geminiWebSessionManager.setEnabledApps(valid)
      broadcastStatus(result.status)
      return success(result)
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.GEMINI_WEB_EXPORT_SESSION,
    async (event) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender)
        const { canceled, filePath } = win
          ? await dialog.showSaveDialog(win, {
              title: 'Export Gemini Session',
              defaultPath: 'gemini-session.enc',
              filters: [
                { name: 'Encrypted Session', extensions: ['enc'] },
                { name: 'All files', extensions: ['*'] }
              ]
            })
          : await dialog.showSaveDialog({
              title: 'Export Gemini Session',
              defaultPath: 'gemini-session.enc',
              filters: [
                { name: 'Encrypted Session', extensions: ['enc'] },
                { name: 'All files', extensions: ['*'] }
              ]
            })

        if (canceled || !filePath) return success({ success: false, error: 'canceled' })
        return success(await geminiWebSessionManager.exportSession(filePath))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        Logger.error('[GeminiWebSession] Export failed:', message)
        return failure('internal_error', message)
      }
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.GEMINI_WEB_IMPORT_SESSION,
    async (event) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender)
        const { canceled, filePaths } = win
          ? await dialog.showOpenDialog(win, {
              title: 'Import Gemini Session',
              filters: [
                { name: 'Encrypted Session', extensions: ['enc'] }
              ],
              properties: ['openFile']
            })
          : await dialog.showOpenDialog({
              title: 'Import Gemini Session',
              filters: [
                { name: 'Encrypted Session', extensions: ['enc'] }
              ],
              properties: ['openFile']
            })

        if (canceled || !filePaths?.length) return success({ success: false, error: 'canceled' })
        return success(await geminiWebSessionManager.importSession(filePaths[0]))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        Logger.error('[GeminiWebSession] Import failed:', message)
        return failure('internal_error', message)
      }
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )
}

export async function shutdownGeminiWebSessionHandlers(): Promise<void> {
  await geminiWebSessionManager.dispose()
}

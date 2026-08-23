import { BrowserWindow } from 'electron'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import type { DoclingModelProgressEvent } from '../../../shared/types/docling.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import {
  deleteModels,
  downloadModels,
  getModelDiskUsage,
  getModelStatus,
  repairModels
} from './doclingModelManager.js'

function broadcastModelProgress(event: DoclingModelProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(APP_CONFIG.IPC_CHANNELS.DOCLING_MODELS_PROGRESS, event)
    }
  }
}

let handlersRegistered = false

export function registerDoclingModelHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_MODELS_GET_STATUS,
    async () => {
      const status = await getModelStatus()
      return success(status)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_MODELS_DOWNLOAD,
    async () => {
      try {
        await downloadModels(undefined, undefined, (e) => broadcastModelProgress(e))
        const status = await getModelStatus()
        return success(status)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        broadcastModelProgress({ phase: 'failed', percent: null, message: msg.slice(0, 200) })
        return failure('internal_error', msg)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_MODELS_DELETE,
    async () => {
      try {
        await deleteModels()
        const status = await getModelStatus()
        return success(status)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return failure('internal_error', msg)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_MODELS_REPAIR,
    async () => {
      try {
        await repairModels(undefined, (e) => broadcastModelProgress(e))
        const status = await getModelStatus()
        return success(status)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        broadcastModelProgress({ phase: 'failed', percent: null, message: msg.slice(0, 200) })
        return failure('internal_error', msg)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_MODELS_GET_DISK_USAGE,
    async () => {
      const bytes = await getModelDiskUsage()
      return success(bytes ?? 0)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}

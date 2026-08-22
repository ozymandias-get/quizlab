import { BrowserWindow } from 'electron'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { doclingServiceManager } from './doclingServiceManager.js'

let handlersRegistered = false
let statusListenerRegistered = false

function broadcastStatus(): void {
  void doclingServiceManager.getStatus().then((status) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(APP_CONFIG.IPC_CHANNELS.DOCLING_SERVICE_STATUS_CHANGED, status)
      }
    }
  })
}

export function registerDoclingServiceHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS } = APP_CONFIG

  if (!statusListenerRegistered) {
    statusListenerRegistered = true
    doclingServiceManager.onStatusChanged((status) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.DOCLING_SERVICE_STATUS_CHANGED, status)
        }
      }
    })
  }

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_SERVICE_GET_STATUS,
    async () => success(await doclingServiceManager.getStatus()),
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_SERVICE_ENSURE_RUNNING,
    async () => {
      try {
        const status = await doclingServiceManager.ensureRunning()
        // Broadcast after state change already emitted by manager, but ensure
        void broadcastStatus()
        return success(status)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const status = await doclingServiceManager.getStatus()
        return success({ ...status, lastError: message })
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_SERVICE_STOP,
    async () => {
      await doclingServiceManager.stop()
      return success(await doclingServiceManager.getStatus())
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_SERVICE_RESTART,
    async () => {
      try {
        await doclingServiceManager.restart()
        return success(await doclingServiceManager.getStatus())
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const status = await doclingServiceManager.getStatus()
        return success({ ...status, lastError: message })
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_SERVICE_HEALTH_CHECK,
    async () => {
      const healthy = await doclingServiceManager.healthCheck()
      const status = await doclingServiceManager.getStatus()
      return success({ healthy, detail: healthy ? undefined : (status.lastError ?? undefined) })
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}

export async function shutdownDoclingService(): Promise<void> {
  await doclingServiceManager.dispose()
}

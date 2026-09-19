import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import {
  getShellIntegrationStatus,
  getShellMenuLabel,
  installShellIntegration,
  removeShellIntegration
} from './shellIntegrationManager.js'

let handlersRegistered = false

export function registerShellOpenHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.SHELL_INTEGRATION_STATUS,
    async () => {
      return success(await getShellIntegrationStatus())
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.SHELL_INTEGRATION_INSTALL,
    async (_event, locale?: string) => {
      const label = getShellMenuLabel(typeof locale === 'string' ? locale : undefined)
      return success(await installShellIntegration(label))
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.SHELL_INTEGRATION_REMOVE,
    async () => {
      return success(await removeShellIntegration())
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}

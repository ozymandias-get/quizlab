import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { nativeMessagingManager } from './nativeMessagingManager.js'

let handlersRegistered = false

export function registerNativeMessagingHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.NATIVE_MESSAGING_STATUS,
    async () => {
      return success(nativeMessagingManager.getExtensionInfo())
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.NATIVE_MESSAGING_PAIRING_CODE,
    async () => {
      return success({ code: nativeMessagingManager.getPairingCode() })
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}

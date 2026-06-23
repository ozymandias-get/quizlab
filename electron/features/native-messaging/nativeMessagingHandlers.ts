import { failure, success } from '../../../shared/lib/typedIpc'
import { registerIpcHandler } from '../../../shared/lib/typedIpcMain'
import { APP_CONFIG } from '../../app/constants'
import { requireTrustedIpcSender } from '../../core/ipcSecurity'
import { nativeMessagingManager } from './nativeMessagingManager'

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
    IPC_CHANNELS.NATIVE_MESSAGING_INSTALL_EXTENSION,
    async () => {
      return success(await nativeMessagingManager.installExtension())
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.NATIVE_MESSAGING_REMOVE_EXTENSION,
    async () => {
      return success(await nativeMessagingManager.removeExtension())
    },
    requireTrustedIpcSender,
    success({ success: false, error: 'Unauthorized' })
  )

  registerIpcHandler(
    IPC_CHANNELS.NATIVE_MESSAGING_BRIDGE_CONFIG,
    async () => {
      return success({
        port: nativeMessagingManager.port,
        host: '127.0.0.1',
        secret: nativeMessagingManager.sharedSecret,
        endpoints: {
          cookies: '/api/cookies',
          health: '/api/health'
        }
      })
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}

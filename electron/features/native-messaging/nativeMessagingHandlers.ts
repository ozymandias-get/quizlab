import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { ExtensionInstallError, getBundledExtensionInstaller } from './extensionInstaller.js'
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

  // Copies the extension that ships with the app to a folder the user can
  // pick in `chrome://extensions`. Chrome cannot be told to load it without
  // that user gesture, so this only prepares and reports the path.
  registerIpcHandler(
    IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_INSTALL,
    async () => {
      try {
        return success(await getBundledExtensionInstaller().install())
      } catch (error) {
        if (error instanceof ExtensionInstallError) {
          return failure(
            error.failure === 'not_found' ? 'not_found' : 'internal_error',
            error.message
          )
        }
        throw error
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}

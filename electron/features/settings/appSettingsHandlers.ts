import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { ConfigManager } from '../../core/ConfigManager.js'
import { getAppSettingsPath } from '../../core/coreHelpers.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'

/**
 * Mirror of the renderer's localStorage for a whitelisted set of preference
 * keys. The renderer writes preferences to localStorage (fast, in-memory) and
 * reports the same values here so they survive cache/profile wipes and stay in
 * sync with the main process (ConfigManager). On startup the renderer hydrates
 * localStorage from this store before React mounts.
 *
 * SECURITY: Only the trusted main window may read/write these settings.
 */

type AppSettingsMap = Record<string, string>

const MAX_KEY_LENGTH = 256
const MAX_VALUE_LENGTH = 1024 * 512 // 512 KB — matches preload IPC limit

let handlersRegistered = false
let settingsManager: ConfigManager<AppSettingsMap> | null = null

function getManager(): ConfigManager<AppSettingsMap> {
  if (!settingsManager) {
    settingsManager = new ConfigManager<AppSettingsMap>(getAppSettingsPath())
  }
  return settingsManager
}

export function registerAppSettingsHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.GET_APP_SETTINGS,
    async () => success(await getManager().read()),
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.SAVE_APP_SETTINGS,
    async (_event, key: string, value: string) => {
      if (typeof key !== 'string' || key.length === 0 || key.length > MAX_KEY_LENGTH) {
        return success(false)
      }
      if (typeof value !== 'string' || value.length > MAX_VALUE_LENGTH) {
        return success(false)
      }
      return success(await getManager().setItem(key, value))
    },
    requireTrustedIpcSender,
    success(false)
  )
}

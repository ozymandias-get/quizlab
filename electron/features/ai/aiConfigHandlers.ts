import { ipcMain } from 'electron'
import type { AiSelectorConfig } from '@shared-core/types'
import { APP_CONFIG } from '../../app/constants'
import { ConfigManager } from '../../core/ConfigManager'
import { getAiConfigPath } from '../../core/helpers'
import { requireTrustedIpcSender } from '../../core/ipcSecurity'
import { CONFIG_VERSION } from './aiConfigConstants'
import type { AiConfigMap } from './aiConfigDomain'
import {
  finalizeStoredConfig,
  mergeConfig,
  readMigratedConfigMap,
  resolveConfigForHostname
} from './aiConfigDomain'
import { normalizeHostname, sanitizeConfig } from './aiConfigSanitize'

export function registerAiConfigHandlers() {
  const { IPC_CHANNELS } = APP_CONFIG
  const manager = new ConfigManager<AiConfigMap>(getAiConfigPath())

  ipcMain.handle(
    IPC_CHANNELS.SAVE_AI_CONFIG,
    async (event, hostname: string, config: AiSelectorConfig) => {
      if (!requireTrustedIpcSender(event)) return false
      const normalizedHostname = normalizeHostname(hostname)
      const sanitizedConfig = sanitizeConfig(config)
      if (!normalizedHostname || !sanitizedConfig) return false

      const currentMap = await readMigratedConfigMap(manager)
      const merged = mergeConfig(currentMap[normalizedHostname], sanitizedConfig)
      const nextConfig = finalizeStoredConfig(normalizedHostname, merged, {
        defaultHealth:
          currentMap[normalizedHostname]?.version === CONFIG_VERSION
            ? currentMap[normalizedHostname]?.health || 'ready'
            : 'ready',
        timestamp: Date.now()
      })

      return manager.write({
        ...currentMap,
        [normalizedHostname]: nextConfig
      })
    }
  )

  ipcMain.handle(IPC_CHANNELS.GET_AI_CONFIG, async (event, hostname?: string) => {
    if (!requireTrustedIpcSender(event)) return null
    const configMap = await readMigratedConfigMap(manager)
    if (!hostname) return configMap
    return resolveConfigForHostname(configMap, hostname)
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_AI_CONFIG, async (event, hostname: string) => {
    if (!requireTrustedIpcSender(event)) return false
    const normalizedHostname = normalizeHostname(hostname)
    if (!normalizedHostname) return false
    return manager.deleteItem(normalizedHostname)
  })
}

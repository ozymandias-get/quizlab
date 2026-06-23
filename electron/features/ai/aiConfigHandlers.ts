import type { AiSelectorConfig } from '@shared-core/types'

import { failure, success } from '../../../shared/lib/typedIpc'
import { APP_CONFIG } from '../../app/constants'
import { ConfigManager } from '../../core/ConfigManager'
import { getAiConfigPath } from '../../core/coreHelpers'
import { requireTrustedIpcSender } from '../../core/ipcSecurity'
import { registerIpcHandler } from '../../core/typedIpcMain'
import { CONFIG_VERSION } from './aiConfigConstants'
import type { AiConfigMap } from './aiConfigDomain'
import {
  finalizeStoredConfig,
  mergeConfig,
  readMigratedConfigMap,
  resolveConfigForHostname
} from './aiConfigDomain'
import { normalizeHostname, sanitizeConfig } from './aiConfigSanitize'

let handlersRegistered = false

export function registerAiConfigHandlers() {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS } = APP_CONFIG
  const manager = new ConfigManager<AiConfigMap>(getAiConfigPath())

  registerIpcHandler(
    IPC_CHANNELS.SAVE_AI_CONFIG,
    async (event, hostname: string, config: AiSelectorConfig) => {
      const normalizedHostname = normalizeHostname(hostname)
      const sanitizedConfig = sanitizeConfig(config)
      if (!normalizedHostname || !sanitizedConfig) return success(false)

      return success(
        await manager.update((currentMap) => {
          const migrated = currentMap as AiConfigMap
          const merged = mergeConfig(migrated[normalizedHostname], sanitizedConfig)
          const nextConfig = finalizeStoredConfig(normalizedHostname, merged, {
            defaultHealth:
              migrated[normalizedHostname]?.version === CONFIG_VERSION
                ? migrated[normalizedHostname]?.health || 'ready'
                : 'ready',
            timestamp: Date.now()
          })

          return {
            ...migrated,
            [normalizedHostname]: nextConfig
          } satisfies AiConfigMap
        })
      )
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.GET_AI_CONFIG,
    async (event, hostname?: string) => {
      const configMap = await readMigratedConfigMap(manager)
      if (!hostname) return success(configMap)
      const resolved = resolveConfigForHostname(configMap, hostname)
      if (!resolved) return failure('not_found', 'Config not found')
      return success(resolved)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DELETE_AI_CONFIG,
    async (event, hostname: string) => {
      const normalizedHostname = normalizeHostname(hostname)
      if (!normalizedHostname) return success(false)
      return success(await manager.deleteItem(normalizedHostname))
    },
    requireTrustedIpcSender,
    success(false)
  )
}

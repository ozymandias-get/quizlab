import type { AiSelectorConfig } from '@shared-core/types'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { ConfigManager } from '../../core/ConfigManager.js'
import { getAiConfigPath } from '../../core/coreHelpers.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { CONFIG_VERSION } from './aiConfigConstants.js'
import type { AiConfigMap } from './aiConfigDomain.js'
import {
  finalizeStoredConfig,
  mergeConfig,
  readMigratedConfigMap,
  resolveConfigForHostname
} from './aiConfigDomain.js'
import { normalizeHostname, sanitizeConfig } from './aiConfigSanitize.js'

let handlersRegistered = false
let configManager: ConfigManager<AiConfigMap> | null = null

/**
 * The one config store the whole process writes through.
 *
 * The IPC handlers and the Chrome transfer both persist here: a second
 * `ConfigManager` on the same file would keep its own cache and could write a
 * stale snapshot over a newer pick.
 */
function getAiConfigManager(): ConfigManager<AiConfigMap> {
  if (!configManager) configManager = new ConfigManager<AiConfigMap>(getAiConfigPath())
  return configManager
}

/** Every stored config, migrated to the current shape. */
export async function readAiConfigMap(): Promise<AiConfigMap> {
  return readMigratedConfigMap(getAiConfigManager())
}

/**
 * Merges one patch into the stored config of a hostname.
 *
 * The same sanitize → merge → finalize path the renderer's save uses, so a
 * field-only patch (one picked locator) keeps the other field exactly as it
 * was and `health` reflects the two locators that remain.
 */
export async function saveAiConfigPatch(
  hostname: string,
  config: AiSelectorConfig
): Promise<boolean> {
  const normalizedHostname = normalizeHostname(hostname)
  const sanitizedConfig = sanitizeConfig(config)
  if (!normalizedHostname || !sanitizedConfig) return false

  const manager = getAiConfigManager()
  return manager.update((currentMap) => {
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
}

export function registerAiConfigHandlers() {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.SAVE_AI_CONFIG,
    async (_event, hostname: string, config: AiSelectorConfig) =>
      success(await saveAiConfigPatch(hostname, config)),
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.GET_AI_CONFIG,
    async (_event, hostname?: string) => {
      const configMap = await readAiConfigMap()
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
    async (_event, hostname: string) => {
      const normalizedHostname = normalizeHostname(hostname)
      if (!normalizedHostname) return success(false)
      return success(await getAiConfigManager().deleteItem(normalizedHostname))
    },
    requireTrustedIpcSender,
    success(false)
  )
}

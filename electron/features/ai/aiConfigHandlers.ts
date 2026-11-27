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
  locatorHealthPatch,
  mergeConfig,
  readMigratedConfigMap,
  resolveConfigForHostname,
  syncWaitForOnInputPick
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

function filterStaleRepairPatch(
  existing: (AiSelectorConfig & { timestamp?: number }) | undefined,
  incoming: AiSelectorConfig
): AiSelectorConfig | null {
  const existingTs = typeof existing?.timestamp === 'number' ? existing.timestamp : 0
  const isRepairPatch = incoming.repair !== undefined || incoming.lastRepair !== undefined
  if (!isRepairPatch) return incoming

  const staleFields = new Set<'input' | 'button'>()
  const cleaned: AiSelectorConfig = { ...incoming }

  if (incoming.lastRepair) {
    if (existingTs && incoming.lastRepair.repairedAt < existingTs) {
      return null
    }
    if (
      incoming.lastRepair.inputSelector &&
      incoming.lastRepair.baseInputSelector !== undefined &&
      existing?.input &&
      incoming.lastRepair.baseInputSelector !== existing.input
    ) {
      staleFields.add('input')
    }
    if (
      incoming.lastRepair.buttonSelector &&
      incoming.lastRepair.baseButtonSelector !== undefined &&
      existing?.button &&
      incoming.lastRepair.baseButtonSelector !== existing.button
    ) {
      staleFields.add('button')
    }
  }

  if (incoming.repair && typeof incoming.repair === 'object') {
    const nextRepair: NonNullable<AiSelectorConfig['repair']> = {}
    let droppedStale = false
    for (const field of ['input', 'button'] as const) {
      const candidate = incoming.repair[field]
      if (!candidate) continue
      const baseMoved =
        candidate.baseSelector !== undefined &&
        Boolean(existing?.[field]) &&
        candidate.baseSelector !== existing?.[field]
      const olderThanExisting =
        existingTs > 0 && candidate.lastSeenAt < existingTs && !existing?.repair?.[field]
      if (baseMoved || olderThanExisting || staleFields.has(field)) {
        droppedStale = true
        staleFields.add(field)
        continue
      }
      nextRepair[field] = candidate
    }
    if (droppedStale) {
      cleaned.repair = nextRepair.input || nextRepair.button ? nextRepair : null
    }
  }

  if (staleFields.has('input')) {
    delete cleaned.input
    delete cleaned.inputCandidates
    if (cleaned.lastRepair) {
      const {
        inputSelector: _i,
        baseInputSelector: _bi,
        inputStrategy: _is,
        ...rest
      } = cleaned.lastRepair
      cleaned.lastRepair = rest.buttonSelector ? rest : undefined
    }
  }
  if (staleFields.has('button')) {
    delete cleaned.button
    delete cleaned.buttonCandidates
    if (cleaned.lastRepair) {
      const {
        buttonSelector: _b,
        baseButtonSelector: _bb,
        buttonStrategy: _bs,
        ...rest
      } = cleaned.lastRepair
      cleaned.lastRepair = rest.inputSelector ? rest : undefined
    }
  }

  if (staleFields.size > 0) {
    if (!cleaned.repair && !cleaned.lastRepair && cleaned.health === 'needs_repick') {
      delete cleaned.health
    }
    if (!cleaned.lastRepair && cleaned.health === 'repaired') {
      delete cleaned.health
    }
    if (
      cleaned.input === undefined &&
      cleaned.button === undefined &&
      cleaned.repair === undefined &&
      cleaned.lastRepair === undefined
    ) {
      return null
    }
  }

  return cleaned
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
  config: AiSelectorConfig,
  options?: { pickedField?: 'input' | 'button' }
): Promise<boolean> {
  const normalizedHostname = normalizeHostname(hostname)
  const sanitizedConfig = sanitizeConfig(config)
  if (!normalizedHostname || !sanitizedConfig) return false

  const manager = getAiConfigManager()
  let rejectedStale = false
  const written = await manager.update((currentMap) => {
    const migrated = currentMap as AiConfigMap
    const existing = migrated[normalizedHostname]

    let effectivePatch = sanitizedConfig
    if (options?.pickedField) {
      const syncedWaitFor =
        options.pickedField === 'input'
          ? syncWaitForOnInputPick(existing, sanitizedConfig.input)
          : undefined
      effectivePatch = {
        ...sanitizedConfig,
        ...(syncedWaitFor ? { waitFor: syncedWaitFor } : {}),
        ...locatorHealthPatch(existing, options.pickedField)
      }
    } else {
      const filtered = filterStaleRepairPatch(existing, sanitizedConfig)
      if (!filtered) {
        rejectedStale = true
        return migrated
      }
      effectivePatch = filtered
    }

    const merged = mergeConfig(existing, effectivePatch)
    const nextConfig = finalizeStoredConfig(normalizedHostname, merged, {
      defaultHealth: existing?.version === CONFIG_VERSION ? existing?.health || 'ready' : 'ready',
      timestamp: Date.now()
    })

    return {
      ...migrated,
      [normalizedHostname]: nextConfig
    } satisfies AiConfigMap
  })
  return written && !rejectedStale
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

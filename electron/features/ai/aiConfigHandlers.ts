import type { AiSelectorConfig, SelectorRepairIntent } from '@shared-core/types'

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

function parseRepairIntent(raw: unknown): SelectorRepairIntent | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const source = raw as Record<string, unknown>
  const validAction = (v: unknown): v is 'update' | 'clear' | 'promote' =>
    v === 'update' || v === 'clear' || v === 'promote'
  const intent: SelectorRepairIntent = {}
  if (validAction(source.input)) intent.input = source.input
  if (validAction(source.button)) intent.button = source.button
  if (typeof source.baseTimestamp === 'number' && Number.isFinite(source.baseTimestamp)) {
    intent.baseTimestamp = source.baseTimestamp
  }
  return intent.input || intent.button || intent.baseTimestamp !== undefined ? intent : undefined
}

function filterStaleRepairPatch(
  existing: (AiSelectorConfig & { timestamp?: number }) | undefined,
  incoming: AiSelectorConfig,
  intent?: SelectorRepairIntent
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
      incoming.lastRepair.baseInputSelector !== (existing?.input ?? null)
    ) {
      staleFields.add('input')
    }
    if (
      incoming.lastRepair.buttonSelector &&
      incoming.lastRepair.baseButtonSelector !== undefined &&
      incoming.lastRepair.baseButtonSelector !== (existing?.button ?? null)
    ) {
      staleFields.add('button')
    }
  }

  if (incoming.repair !== undefined) {
    const incomingRepairObj =
      incoming.repair && typeof incoming.repair === 'object' ? incoming.repair : null
    const nextRepair: NonNullable<AiSelectorConfig['repair']> = {}
    let repairModified = false
    const baseTs = intent?.baseTimestamp ?? 0

    for (const field of ['input', 'button'] as const) {
      const candidate = incomingRepairObj?.[field] ?? null
      const fieldIntent = intent?.[field]
      const existingCandidate = existing?.repair?.[field] ?? null

      if (!candidate) {
        if (!existingCandidate) continue
        const promotedThisField =
          fieldIntent === 'promote' ||
          Boolean(incoming.lastRepair?.[`${field}Selector` as 'inputSelector' | 'buttonSelector'])
        if (promotedThisField && !staleFields.has(field)) {
          // Promotion intentionally clears the staged candidate.
          continue
        }
        if (fieldIntent === 'clear') {
          // Intentional clear succeeds unless this field's own candidate was
          // updated after this repair read its base snapshot. Do not use the
          // site-wide `existingTs` here, or an unrelated field update would
          // block a valid clear.
          const newerOnDisk = baseTs > 0 && existingCandidate.lastSeenAt > baseTs
          if (newerOnDisk) {
            nextRepair[field] = existingCandidate
            repairModified = true
          }
          continue
        }
        // Untouched field (or null snapshot from a concurrent operation on the
        // other locator): preserve existing unless this was an explicit full
        // `{ repair: null }` reset with no intent and no other fields.
        const explicitFullReset =
          incomingRepairObj === null &&
          !intent &&
          !incoming.lastRepair &&
          incoming.input === undefined &&
          incoming.button === undefined
        if (!explicitFullReset) {
          nextRepair[field] = existingCandidate
          repairModified = true
        }
        continue
      }

      if (intent && fieldIntent === undefined) {
        // When repairIntent is present, an unmentioned field was not touched by
        // this repair and must keep whatever is currently on disk.
        if (existingCandidate) {
          nextRepair[field] = existingCandidate
        }
        repairModified = true
        continue
      }

      const baseMoved =
        candidate.baseSelector !== undefined &&
        candidate.baseSelector !== (existing?.[field] ?? null)
      const startedBeforeLatestWrite =
        existingTs > 0 &&
        (candidate.lastSeenAt < existingTs ||
          (candidate.baseSelector === undefined && candidate.firstSeenAt < existingTs) ||
          (baseTs > 0 && existingTs > baseTs)) &&
        !existingCandidate
      const counterRegressed =
        Boolean(existingCandidate) && candidate.lastSeenAt < (existingCandidate?.lastSeenAt ?? 0)
      if (baseMoved || startedBeforeLatestWrite || counterRegressed || staleFields.has(field)) {
        repairModified = true
        if (baseMoved || startedBeforeLatestWrite) staleFields.add(field)
        if (counterRegressed && existingCandidate && !baseMoved && !startedBeforeLatestWrite) {
          nextRepair[field] = existingCandidate
        }
        continue
      }
      nextRepair[field] = candidate
    }
    if (repairModified || incomingRepairObj === null) {
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
 *
 * When no exact config exists for `normalizedHostname`, falls back to the
 * effective canonical config (`resolveConfigForHostname`) as the merge base so
 * picking one field on a subdomain does not shadow the inherited other field,
 * `waitFor`, or `submitMode`.
 */
export async function saveAiConfigPatch(
  hostname: string,
  config: AiSelectorConfig,
  options?: { pickedField?: 'input' | 'button' | 'pair' }
): Promise<boolean> {
  const normalizedHostname = normalizeHostname(hostname)
  const repairIntent = parseRepairIntent(config?.repairIntent)
  const sanitizedConfig = sanitizeConfig(config)
  if (!normalizedHostname || !sanitizedConfig) return false

  const manager = getAiConfigManager()
  let rejectedStale = false
  const written = await manager.update((currentMap) => {
    const migrated = currentMap as AiConfigMap
    const exact = migrated[normalizedHostname]
    const existing = exact ?? resolveConfigForHostname(migrated, normalizedHostname) ?? undefined

    let effectivePatch = sanitizedConfig
    if (options?.pickedField) {
      const syncedWaitFor =
        options.pickedField === 'input' || options.pickedField === 'pair'
          ? syncWaitForOnInputPick(existing, sanitizedConfig.input)
          : undefined
      effectivePatch = {
        ...sanitizedConfig,
        ...(syncedWaitFor ? { waitFor: syncedWaitFor } : {}),
        ...locatorHealthPatch(existing, options.pickedField)
      }
    } else {
      const filtered = filterStaleRepairPatch(existing, sanitizedConfig, repairIntent)
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

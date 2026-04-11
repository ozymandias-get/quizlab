import {
  canonicalizeHostname,
  normalizeSelectorHealth,
  normalizeSubmitMode
} from '../../../shared/selectorConfig'
import type {
  AiSelectorConfig,
  AutomationElementFingerprint,
  SelectorHealth
} from '@shared-core/types'
import { CONFIG_KEYS, CONFIG_VERSION } from './aiConfigConstants'
import { normalizeHostname, sanitizeConfig } from './aiConfigSanitize'
import type { ConfigManager } from '../../core/ConfigManager'

export type StoredAiConfig = AiSelectorConfig & { timestamp?: number }
export type AiConfigMap = Record<string, StoredAiConfig>

function hasLocator(locator: {
  selector?: string | null
  candidates?: string[] | null
  fingerprint?: AutomationElementFingerprint | null
}) {
  const { selector, candidates, fingerprint } = locator
  return Boolean(selector || candidates?.length || fingerprint)
}

export function finalizeStoredConfig(
  hostname: string,
  config: AiSelectorConfig,
  options: { defaultHealth: SelectorHealth; timestamp?: number }
): StoredAiConfig {
  const normalizedHostname = normalizeHostname(hostname) || hostname
  const sourceHostname = normalizeHostname(config.sourceHostname) || normalizedHostname
  const canonicalHostname =
    canonicalizeHostname(config.canonicalHostname || sourceHostname) || sourceHostname
  const inputCandidates =
    config.inputCandidates && config.inputCandidates.length > 0
      ? config.inputCandidates
      : config.input
        ? [config.input]
        : null
  const buttonCandidates =
    config.buttonCandidates && config.buttonCandidates.length > 0
      ? config.buttonCandidates
      : config.button
        ? [config.button]
        : null
  const input = config.input ?? inputCandidates?.[0] ?? null
  const button = config.button ?? buttonCandidates?.[0] ?? null
  const waitFor = config.waitFor ?? input ?? inputCandidates?.[0] ?? null
  const submitMode = normalizeSubmitMode(config.submitMode) || 'mixed'
  const inputFingerprint = config.inputFingerprint ?? null
  const buttonFingerprint = config.buttonFingerprint ?? null

  let health = normalizeSelectorHealth(config.health) || options.defaultHealth
  const hasInput = hasLocator({
    selector: input,
    candidates: inputCandidates,
    fingerprint: inputFingerprint
  })
  const hasButton = hasLocator({
    selector: button,
    candidates: buttonCandidates,
    fingerprint: buttonFingerprint
  })
  if (!hasInput || !hasButton) {
    health = 'needs_repick'
  }

  return {
    version: CONFIG_VERSION,
    input,
    button,
    waitFor,
    submitMode,
    inputCandidates,
    buttonCandidates,
    inputFingerprint,
    buttonFingerprint,
    sourceUrl: config.sourceUrl ?? null,
    sourceHostname,
    canonicalHostname,
    health,
    ...(options.timestamp !== undefined ? { timestamp: options.timestamp } : {})
  }
}

export function mergeConfig(
  existing: StoredAiConfig | undefined,
  incoming: AiSelectorConfig
): AiSelectorConfig {
  const merged: AiSelectorConfig = { ...(existing || {}) }
  const writableMerged = merged as Record<string, unknown>

  for (const key of CONFIG_KEYS) {
    if (key in incoming) {
      const value = incoming[key]
      if (value !== undefined) {
        writableMerged[key] = value
      }
    }
  }

  return merged
}

export function migrateConfigMap(map: AiConfigMap): { data: AiConfigMap; changed: boolean } {
  let changed = false
  const next: AiConfigMap = {}

  for (const [hostname, rawConfig] of Object.entries(map)) {
    const normalizedHostname = normalizeHostname(hostname)
    if (!normalizedHostname) {
      changed = true
      continue
    }

    const sanitized = sanitizeConfig(rawConfig)
    if (!sanitized) {
      next[normalizedHostname] = finalizeStoredConfig(
        normalizedHostname,
        {
          sourceHostname: normalizedHostname,
          canonicalHostname: canonicalizeHostname(normalizedHostname) || normalizedHostname,
          submitMode: 'mixed',
          health: 'needs_repick'
        },
        {
          defaultHealth: 'needs_repick',
          timestamp: typeof rawConfig?.timestamp === 'number' ? rawConfig.timestamp : Date.now()
        }
      )
      changed = true
      continue
    }

    const defaultHealth =
      sanitized.version === CONFIG_VERSION && sanitized.health === 'ready' ? 'ready' : 'migrated'
    const migrated = finalizeStoredConfig(normalizedHostname, sanitized, {
      defaultHealth,
      timestamp: typeof rawConfig?.timestamp === 'number' ? rawConfig.timestamp : Date.now()
    })

    next[normalizedHostname] = migrated
    if (normalizedHostname !== hostname || JSON.stringify(migrated) !== JSON.stringify(rawConfig)) {
      changed = true
    }
  }

  return { data: next, changed }
}

export async function readMigratedConfigMap(
  manager: ConfigManager<AiConfigMap>
): Promise<AiConfigMap> {
  const raw = await manager.read()
  const migrated = migrateConfigMap(raw)
  if (migrated.changed) {
    await manager.write(migrated.data)
  }
  return migrated.data
}

export function resolveConfigForHostname(
  configMap: AiConfigMap,
  hostname?: string
): StoredAiConfig | null {
  const normalizedHostname = normalizeHostname(hostname)
  if (!normalizedHostname) {
    return null
  }

  const exact = configMap[normalizedHostname]
  if (exact) {
    return exact
  }

  const canonicalHostname = canonicalizeHostname(normalizedHostname)
  if (!canonicalHostname) {
    return null
  }

  const canonicalExact = configMap[canonicalHostname]
  if (canonicalExact) {
    return canonicalExact
  }

  const matches = Object.values(configMap).filter(
    (config) => config.canonicalHostname === canonicalHostname
  )
  if (matches.length === 1) {
    return matches[0] || null
  }

  return null
}

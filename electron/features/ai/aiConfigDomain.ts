import type {
  AiSelectorConfig,
  AutomationElementFingerprint,
  SelectorHealth
} from '@shared-core/types'

import {
  canonicalizeHostname,
  normalizeSelectorHealth,
  normalizeSubmitMode
} from '../../../shared/selectorConfig.js'
import type { ConfigManager } from '../../core/ConfigManager.js'
import { CONFIG_KEYS, CONFIG_VERSION } from './aiConfigConstants.js'
import { normalizeHostname, sanitizeConfig } from './aiConfigSanitize.js'

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

function normalizeRepairState(
  repair: AiSelectorConfig['repair']
): AiSelectorConfig['repair'] | null {
  if (!repair || typeof repair !== 'object') return null
  const input = repair.input ?? null
  const button = repair.button ?? null
  if (!input && !button) return null
  return { input, button }
}

function normalizeLastRepair(
  lastRepair: AiSelectorConfig['lastRepair']
): AiSelectorConfig['lastRepair'] | null {
  if (!lastRepair || typeof lastRepair !== 'object') return null
  if (typeof lastRepair.repairedAt !== 'number' || !Number.isFinite(lastRepair.repairedAt)) {
    return null
  }
  return lastRepair
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
  // Self-healing state is carried through verbatim. It is bounded, sanitized
  // metadata (selector + counters + timestamps) and holds no DOM, page text,
  // prompt content or credentials.
  const repair = normalizeRepairState(config.repair)
  const lastRepair = normalizeLastRepair(config.lastRepair)

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
    repair,
    lastRepair,
    ...(options.timestamp !== undefined ? { timestamp: options.timestamp } : {})
  }
}

/**
 * Prototype-pollution-safe key setter.  Only allows keys from the CONFIG_KEYS
 * whitelist to be written, which implicitly rejects __proto__, constructor,
 * and prototype.  This is defense-in-depth: sanitizeConfig() and the whitelist
 * already prevent untrusted keys from reaching mergeConfig().
 */
const PROHIBITED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function mergeConfig(
  existing: StoredAiConfig | undefined,
  incoming: AiSelectorConfig
): AiSelectorConfig {
  const merged: AiSelectorConfig = { ...(existing || {}) }
  const writableMerged = merged as Record<string, unknown>

  for (const key of CONFIG_KEYS) {
    // SECURITY: Skip prototype-pollution keys even though CONFIG_KEYS is a
    // whitelist of known-safe keys.  This defense-in-depth protects against
    // a future change accidentally adding a dangerous key to CONFIG_KEYS or
    // allowing a non-whitelist code path to reach this function.
    if (PROHIBITED_KEYS.has(key)) continue

    if (key in incoming) {
      const val = incoming[key]
      if (val !== undefined) {
        writableMerged[key] = val
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

/**
 * Migrated config maps, keyed by the raw object the manager handed back.
 *
 * `ConfigManager.read()` returns the same object reference until the file
 * changes, so a raw→migrated pair can be remembered instead of re-running
 * `migrateConfigMap` (and its `JSON.stringify` comparison) on every IPC read.
 * A `WeakMap` ties the entry to the lifetime of the raw object: it disappears
 * with it rather than pinning a config map in memory for the process lifetime.
 */
const migratedConfigMaps = new WeakMap<AiConfigMap, AiConfigMap>()

export async function readMigratedConfigMap(
  manager: ConfigManager<AiConfigMap>
): Promise<AiConfigMap> {
  const raw = await manager.read()
  const cached = migratedConfigMaps.get(raw)
  if (cached) {
    return cached
  }
  const migrated = migrateConfigMap(raw)
  if (!migrated.changed) {
    migratedConfigMaps.set(raw, migrated.data)
    migratedConfigMaps.set(migrated.data, migrated.data)
    return migrated.data
  }
  // The write goes through `update`, not `write`: a pick or a settings save can
  // land between the read above and this write, and `write(migrated.data)`
  // would replace that newer config with the pre-write snapshot. The updater
  // re-migrates whatever the queue hands it.
  const written = await manager.update((current) =>
    current === raw ? migrated.data : migrateConfigMap(current).data
  )
  if (!written) {
    return migrated.data
  }
  const persisted = await manager.read()
  migratedConfigMaps.set(raw, persisted)
  migratedConfigMaps.set(persisted, persisted)
  return persisted
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

  return null
}

/**
 * The health/repair part of a one-field pick.
 *
 * `health` is site-wide while `repair` is per locator. A pick clears only its
 * own staged repair. When `needs_repick` was caused by this locator's staged
 * candidate it becomes `ready` again; a problem staged for the other locator
 * keeps the site in `needs_repick`, because this pick says nothing about it.
 */
export function locatorHealthPatch(
  existing: AiSelectorConfig | undefined,
  field: 'input' | 'button' | 'pair'
): Pick<AiSelectorConfig, 'health' | 'repair'> {
  if (field === 'pair') {
    return { health: 'ready', repair: null }
  }

  const previousRepair = existing?.repair ?? null
  let nextRepair = previousRepair
  if (previousRepair) {
    const remaining: NonNullable<AiSelectorConfig['repair']> = { ...previousRepair }
    delete remaining[field]
    nextRepair = remaining.input || remaining.button ? remaining : null
  }

  const other: 'input' | 'button' = field === 'input' ? 'button' : 'input'
  let health: NonNullable<AiSelectorConfig['health']> = 'ready'
  if (existing?.health === 'needs_repick') {
    const attributedToThisPick = Boolean(previousRepair?.[field])
    const otherStillBroken = Boolean(previousRepair?.[other])
    const wasMissingThisField = !existing?.[field]
    health =
      otherStillBroken || (!attributedToThisPick && !wasMissingThisField) ? 'needs_repick' : 'ready'
  }

  return { health, repair: nextRepair }
}

/**
 * Returns the new `waitFor` selector when an `input` pick replaces an
 * auto-derived `waitFor` (empty, equal to the previous `input`, or in
 * `inputCandidates`). Independent custom `waitFor` values are preserved.
 */
export function syncWaitForOnInputPick(
  existing: AiSelectorConfig | undefined,
  nextInput: string | null | undefined
): string | undefined {
  if (!nextInput) return undefined
  const previousWaitFor = typeof existing?.waitFor === 'string' ? existing.waitFor.trim() : ''
  if (!previousWaitFor) return nextInput
  const previousInput = typeof existing?.input === 'string' ? existing.input.trim() : ''
  const previousCandidates = Array.isArray(existing?.inputCandidates)
    ? existing.inputCandidates
    : []
  if (previousWaitFor === previousInput || previousCandidates.includes(previousWaitFor)) {
    return nextInput
  }
  return undefined
}

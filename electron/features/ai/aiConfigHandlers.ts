import { ipcMain } from 'electron'
import { APP_CONFIG } from '../../app/constants'
import { getAiConfigPath } from '../../core/helpers'
import { requireTrustedIpcSender } from '../../core/ipcSecurity'
import { ConfigManager } from '../../core/ConfigManager'
import {
  canonicalizeHostname,
  normalizeSelectorHealth,
  normalizeSubmitMode
} from '../../../shared/selectorConfig'
import type {
  AiSelectorConfig,
  AutomationElementFingerprint,
  AutomationHostDescriptor,
  SelectorHealth
} from '@shared-core/types'

type StoredAiConfig = AiSelectorConfig & { timestamp?: number }
type AiConfigMap = Record<string, StoredAiConfig>

const CONFIG_VERSION = 2
const MAX_SELECTOR_LENGTH = 2000
const MAX_SUBMIT_MODE_LENGTH = 64
const MAX_URL_LENGTH = 2048
const MAX_CANDIDATE_COUNT = 12
const MAX_CLASS_TOKENS = 4
const MAX_CLASS_TOKEN_LENGTH = 64
const MAX_PATH_SEGMENTS = 8
const MAX_SEGMENT_LENGTH = 256

const HOSTNAME_REGEX = /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*$/i

const CONFIG_KEYS = [
  'version',
  'input',
  'button',
  'waitFor',
  'submitMode',
  'inputCandidates',
  'buttonCandidates',
  'inputFingerprint',
  'buttonFingerprint',
  'sourceUrl',
  'sourceHostname',
  'canonicalHostname',
  'health'
] as const satisfies readonly (keyof AiSelectorConfig)[]

function normalizeHostname(hostname: unknown): string | null {
  if (typeof hostname !== 'string') return null
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!normalized || normalized.includes('/') || !HOSTNAME_REGEX.test(normalized)) {
    return null
  }
  return normalized
}

function sanitizeSelector(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized || normalized.length > MAX_SELECTOR_LENGTH) return undefined
  return normalized
}

function sanitizeString(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) return undefined
  return normalized
}

function sanitizeCssSelectors(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!Array.isArray(value)) return undefined

  const normalized: string[] = []
  for (const entry of value) {
    const selector = sanitizeSelector(entry)
    if (!selector) continue
    if (normalized.includes(selector)) continue
    normalized.push(selector)
    if (normalized.length >= MAX_CANDIDATE_COUNT) break
  }

  return normalized
}

function sanitizeClassTokens(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!Array.isArray(value)) return undefined

  const normalized: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const token = entry.trim()
    if (!token || token.length > MAX_CLASS_TOKEN_LENGTH) continue
    if (normalized.includes(token)) continue
    normalized.push(token)
    if (normalized.length >= MAX_CLASS_TOKENS) break
  }

  return normalized
}

function sanitizePathSegments(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!Array.isArray(value)) return undefined

  const normalized: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const segment = entry.trim()
    if (!segment || segment.length > MAX_SEGMENT_LENGTH) continue
    normalized.push(segment)
    if (normalized.length >= MAX_PATH_SEGMENTS) break
  }

  return normalized
}

function sanitizeHostDescriptor(value: unknown): AutomationHostDescriptor | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<AutomationHostDescriptor>
  const selector = sanitizeSelector(raw.selector)
  const tag = sanitizeString(raw.tag, 64)
  if (!selector || !tag) {
    return null
  }

  const safeId = sanitizeString(raw.safeId, 256)
  const dataTestId = sanitizeString(raw.dataTestId, 256)
  const classTokens = sanitizeClassTokens(raw.classTokens)
  const nthChild =
    typeof raw.nthChild === 'number' && Number.isInteger(raw.nthChild) && raw.nthChild > 0
      ? raw.nthChild
      : undefined

  return {
    selector,
    tag,
    ...(safeId !== undefined ? { safeId } : {}),
    ...(dataTestId !== undefined ? { dataTestId } : {}),
    ...(classTokens !== undefined ? { classTokens } : {}),
    ...(nthChild !== undefined ? { nthChild } : {})
  }
}

function sanitizeHostChain(value: unknown): AutomationHostDescriptor[] | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!Array.isArray(value)) return undefined

  const normalized: AutomationHostDescriptor[] = []
  for (const entry of value) {
    const descriptor = sanitizeHostDescriptor(entry)
    if (!descriptor) continue
    normalized.push(descriptor)
    if (normalized.length >= MAX_PATH_SEGMENTS) break
  }

  return normalized
}

function sanitizeFingerprint(value: unknown): AutomationElementFingerprint | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!value || typeof value !== 'object') return undefined

  const raw = value as Partial<AutomationElementFingerprint>
  const tag = sanitizeString(raw.tag, 64)
  if (!tag) return undefined

  const role = sanitizeString(raw.role, 128)
  const type = sanitizeString(raw.type, 64)
  const text = sanitizeString(raw.text, 256)
  const name = sanitizeString(raw.name, 256)
  const placeholder = sanitizeString(raw.placeholder, 256)
  const ariaLabel = sanitizeString(raw.ariaLabel, 256)
  const dataTestId = sanitizeString(raw.dataTestId, 256)
  const safeId = sanitizeString(raw.safeId, 256)
  const classTokens = sanitizeClassTokens(raw.classTokens)
  const localPath = sanitizePathSegments(raw.localPath)
  const hostChain = sanitizeHostChain(raw.hostChain)
  const contentEditable = typeof raw.contentEditable === 'boolean' ? raw.contentEditable : undefined

  return {
    tag,
    ...(role !== undefined ? { role } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(contentEditable !== undefined ? { contentEditable } : {}),
    ...(text !== undefined ? { text } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(placeholder !== undefined ? { placeholder } : {}),
    ...(ariaLabel !== undefined ? { ariaLabel } : {}),
    ...(dataTestId !== undefined ? { dataTestId } : {}),
    ...(safeId !== undefined ? { safeId } : {}),
    ...(classTokens !== undefined ? { classTokens } : {}),
    ...(localPath !== undefined ? { localPath } : {}),
    ...(hostChain !== undefined ? { hostChain } : {})
  }
}

function sanitizeSourceUrl(value: unknown): string | null | undefined {
  const normalized = sanitizeString(value, MAX_URL_LENGTH)
  if (normalized === undefined || normalized === null) {
    return normalized
  }

  try {
    return new URL(normalized).toString()
  } catch {
    return undefined
  }
}

function sanitizeConfig(config: unknown): AiSelectorConfig | null {
  if (!config || typeof config !== 'object') return null
  const raw = config as AiSelectorConfig

  const input = sanitizeSelector(raw.input)
  const button = sanitizeSelector(raw.button)
  const waitFor = sanitizeSelector(raw.waitFor)
  const inputCandidates = sanitizeCssSelectors(raw.inputCandidates)
  const buttonCandidates = sanitizeCssSelectors(raw.buttonCandidates)
  const inputFingerprint = sanitizeFingerprint(raw.inputFingerprint)
  const buttonFingerprint = sanitizeFingerprint(raw.buttonFingerprint)
  const sourceUrl = sanitizeSourceUrl(raw.sourceUrl)
  const sourceHostname = normalizeHostname(raw.sourceHostname)
  const canonicalHostname = canonicalizeHostname(raw.canonicalHostname || sourceHostname || null)
  const health = normalizeSelectorHealth(raw.health)

  if (
    (raw.input !== undefined && input === undefined) ||
    (raw.button !== undefined && button === undefined) ||
    (raw.waitFor !== undefined && waitFor === undefined) ||
    (raw.inputCandidates !== undefined && inputCandidates === undefined) ||
    (raw.buttonCandidates !== undefined && buttonCandidates === undefined) ||
    (raw.inputFingerprint !== undefined && inputFingerprint === undefined) ||
    (raw.buttonFingerprint !== undefined && buttonFingerprint === undefined) ||
    (raw.sourceUrl !== undefined && sourceUrl === undefined) ||
    (raw.sourceHostname !== undefined && sourceHostname === null) ||
    (raw.canonicalHostname !== undefined && canonicalHostname === null) ||
    (raw.health !== undefined && !health)
  ) {
    return null
  }

  const version = raw.version === CONFIG_VERSION ? CONFIG_VERSION : undefined
  const submitMode = raw.submitMode === undefined ? undefined : normalizeSubmitMode(raw.submitMode)

  if (
    raw.submitMode !== undefined &&
    (!submitMode || String(raw.submitMode).length > MAX_SUBMIT_MODE_LENGTH)
  ) {
    return null
  }

  return {
    ...(version ? { version } : {}),
    ...(input !== undefined ? { input } : {}),
    ...(button !== undefined ? { button } : {}),
    ...(waitFor !== undefined ? { waitFor } : {}),
    ...(submitMode !== undefined ? { submitMode } : {}),
    ...(inputCandidates !== undefined ? { inputCandidates } : {}),
    ...(buttonCandidates !== undefined ? { buttonCandidates } : {}),
    ...(inputFingerprint !== undefined ? { inputFingerprint } : {}),
    ...(buttonFingerprint !== undefined ? { buttonFingerprint } : {}),
    ...(sourceUrl !== undefined ? { sourceUrl } : {}),
    ...(sourceHostname ? { sourceHostname } : {}),
    ...(canonicalHostname ? { canonicalHostname } : {}),
    ...(health ? { health } : {})
  }
}

function hasLocator(locator: {
  selector?: string | null
  candidates?: string[] | null
  fingerprint?: AutomationElementFingerprint | null
}) {
  const { selector, candidates, fingerprint } = locator
  return Boolean(selector || candidates?.length || fingerprint)
}

function finalizeStoredConfig(
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

function mergeConfig(
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

function migrateConfigMap(map: AiConfigMap): { data: AiConfigMap; changed: boolean } {
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

    const migrated = finalizeStoredConfig(normalizedHostname, sanitized, {
      defaultHealth:
        sanitized.version === CONFIG_VERSION
          ? sanitizeConfig(rawConfig)?.health === 'ready'
            ? 'ready'
            : 'migrated'
          : 'migrated',
      timestamp: typeof rawConfig?.timestamp === 'number' ? rawConfig.timestamp : Date.now()
    })

    next[normalizedHostname] = migrated
    if (normalizedHostname !== hostname || JSON.stringify(migrated) !== JSON.stringify(rawConfig)) {
      changed = true
    }
  }

  return { data: next, changed }
}

async function readMigratedConfigMap(manager: ConfigManager<AiConfigMap>): Promise<AiConfigMap> {
  const raw = await manager.read()
  const migrated = migrateConfigMap(raw)
  if (migrated.changed) {
    await manager.write(migrated.data)
  }
  return migrated.data
}

function resolveConfigForHostname(
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

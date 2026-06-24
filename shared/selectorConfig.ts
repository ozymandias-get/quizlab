import type {
  AiSelectorConfig,
  AutomationConfig,
  SelectorHealth,
  SubmitMode
} from './types/index.js'

const REGISTRABLE_THIRD_LEVEL_SUFFIXES = new Set(['co', 'com', 'net', 'org', 'gov', 'edu'])

const KNOWN_HOST_PREFIXES = new Set(['www', 'app', 'chat'])

export function normalizeSubmitMode(value: unknown): SubmitMode | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }

  if (normalized === 'enter' || normalized === 'enter_key') {
    return 'enter_key'
  }

  if (normalized === 'click' || normalized === 'mixed') {
    return normalized
  }

  return undefined
}

export function canonicalizeHostname(hostname: unknown): string | null {
  if (typeof hostname !== 'string') {
    return null
  }

  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!normalized) {
    return null
  }

  const labels = normalized.split('.').filter(Boolean)
  if (labels.length <= 2) {
    return normalized
  }

  const [first] = labels
  if (first && KNOWN_HOST_PREFIXES.has(first) && labels.length > 2) {
    const withoutPrefix = labels.slice(1)
    return canonicalizeHostname(withoutPrefix.join('.'))
  }

  const last = labels[labels.length - 1] || ''
  const secondLast = labels[labels.length - 2] || ''
  const thirdLast = labels[labels.length - 3] || ''

  if (
    last.length === 2 &&
    secondLast.length <= 3 &&
    REGISTRABLE_THIRD_LEVEL_SUFFIXES.has(secondLast) &&
    thirdLast
  ) {
    return labels.slice(-3).join('.')
  }

  return labels.slice(-2).join('.')
}

export function normalizeSelectorHealth(value: unknown): SelectorHealth | undefined {
  if (value === 'ready' || value === 'migrated' || value === 'needs_repick') {
    return value
  }

  return undefined
}

/**
 * Convert an `AiSelectorConfig` (potentially loose-typed) into a strict
 * `AutomationConfig` shape suitable for IPC/script generation. Centralized
 * here so that the AI sender pipeline and the Settings selectors UI use
 * the same normalization rules.
 */
export function toAutomationConfig(config: AiSelectorConfig): AutomationConfig {
  return {
    version: config.version === 2 ? 2 : undefined,
    input: typeof config.input === 'string' || config.input === null ? config.input : null,
    button: typeof config.button === 'string' || config.button === null ? config.button : null,
    waitFor: typeof config.waitFor === 'string' || config.waitFor === null ? config.waitFor : null,
    submitMode: normalizeSubmitMode(config.submitMode) || undefined,
    inputCandidates: Array.isArray(config.inputCandidates) ? config.inputCandidates : null,
    buttonCandidates: Array.isArray(config.buttonCandidates) ? config.buttonCandidates : null,
    inputFingerprint: config.inputFingerprint || null,
    buttonFingerprint: config.buttonFingerprint || null,
    sourceUrl: typeof config.sourceUrl === 'string' ? config.sourceUrl : null,
    sourceHostname: typeof config.sourceHostname === 'string' ? config.sourceHostname : null,
    canonicalHostname:
      typeof config.canonicalHostname === 'string' ? config.canonicalHostname : null,
    health: config.health
  }
}

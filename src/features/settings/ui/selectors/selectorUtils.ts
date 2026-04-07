import { canonicalizeHostname, normalizeSubmitMode } from '@shared-core/selectorConfig'
import type {
  AiPlatform,
  AiSelectorConfig,
  AutomationConfig,
  AutomationExecutionResult
} from '@shared-core/types'
import type { SelectorEntry } from './types'

export function normalizeSelectorsData(
  selectorsData: AiSelectorConfig | Record<string, AiSelectorConfig> | null | undefined
) {
  if (!selectorsData || 'input' in selectorsData) {
    return {}
  }

  return selectorsData as Record<string, AiSelectorConfig>
}

export function hasSelectorLocator(config?: AiSelectorConfig | null) {
  if (!config) return false

  return Boolean(
    config.input ||
      config.button ||
      config.inputCandidates?.length ||
      config.buttonCandidates?.length ||
      config.inputFingerprint ||
      config.buttonFingerprint
  )
}

export function findSelectorEntry(ai: AiPlatform, selectors: Record<string, AiSelectorConfig>) {
  if (!ai.url) {
    return null
  }

  try {
    const aiHost = new URL(ai.url).hostname.toLowerCase()
    const canonicalHostname = canonicalizeHostname(aiHost) || aiHost

    if (selectors[aiHost]) {
      return {
        hostname: aiHost,
        config: selectors[aiHost] as AiSelectorConfig
      } satisfies SelectorEntry
    }

    if (selectors[canonicalHostname]) {
      return {
        hostname: canonicalHostname,
        config: selectors[canonicalHostname] as AiSelectorConfig
      } satisfies SelectorEntry
    }

    const sourceMatch = Object.entries(selectors).find(([, config]) => {
      const sourceHostname =
        typeof config.sourceHostname === 'string' ? config.sourceHostname.toLowerCase() : null
      return sourceHostname === aiHost
    })

    if (sourceMatch) {
      const [hostname, config] = sourceMatch
      return { hostname, config }
    }

    const canonicalMatches = Object.entries(selectors).filter(([, config]) => {
      const sourceCanonical =
        typeof config.canonicalHostname === 'string' ? config.canonicalHostname.toLowerCase() : null
      return sourceCanonical === canonicalHostname
    })

    if (canonicalMatches.length === 1) {
      const [hostname, config] = canonicalMatches[0] || []
      if (hostname && config) {
        return { hostname, config }
      }
    }
  } catch {
    return null
  }

  return null
}

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

export function normalizeExecutionResult(value: unknown): AutomationExecutionResult | null {
  if (typeof value === 'boolean') {
    return { success: value }
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<AutomationExecutionResult>
  return {
    success: typeof candidate.success === 'boolean' ? candidate.success : !candidate.error,
    error: candidate.error,
    mode: candidate.mode,
    action: candidate.action,
    diagnostics: candidate.diagnostics
  }
}

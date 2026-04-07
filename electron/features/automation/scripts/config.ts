import { normalizeSubmitMode } from '../../../../shared/selectorConfig'
import type { AutomationConfig } from '@shared-core/types'

interface ScriptLookupConfig {
  selectors: string[]
  fingerprint: AutomationConfig['inputFingerprint']
}

export interface SerializedAutomationConfig {
  input: ScriptLookupConfig
  button: ScriptLookupConfig
  waitFor: ScriptLookupConfig
  submitMode: string
  health: AutomationConfig['health'] | null
}

/**
 * Serializes and normalizes the automation configuration before it is embedded into a script.
 *
 * Goals:
 * - Ensure selector lists are trimmed/deduplicated and include fallbacks (candidates).
 * - Ensure submitMode is normalized to the supported set.
 * - Keep the embedded JSON stable for caching and diagnostics.
 */
function uniqueSelectors(values: Array<string | null | undefined>) {
  const selectors: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') continue
    const normalized = value.trim()
    if (!normalized || selectors.includes(normalized)) continue
    selectors.push(normalized)
  }

  return selectors
}

export function serializeAutomationConfig(config: AutomationConfig): SerializedAutomationConfig {
  return {
    input: {
      selectors: uniqueSelectors([
        config.input,
        ...(Array.isArray(config.inputCandidates) ? config.inputCandidates : []),
        config.waitFor
      ]),
      fingerprint: config.inputFingerprint || null
    },
    button: {
      selectors: uniqueSelectors([
        config.button,
        ...(Array.isArray(config.buttonCandidates) ? config.buttonCandidates : [])
      ]),
      fingerprint: config.buttonFingerprint || null
    },
    waitFor: {
      selectors: uniqueSelectors([
        config.waitFor,
        config.input,
        ...(Array.isArray(config.inputCandidates) ? config.inputCandidates : [])
      ]),
      fingerprint: config.inputFingerprint || null
    },
    submitMode: normalizeSubmitMode(config.submitMode) || 'mixed',
    health: config.health || null
  }
}

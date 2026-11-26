// Selector data helpers for the Settings › Selectors UI.
//
// Note: selector classification, priority ordering and validation are
// deliberately NOT re-exported here. Those rules are mirrored into the
// automation script injected into the page (see
// electron/features/automation/automationScripts), and that script is what
// actually scores and validates selectors at runtime via the
// generateValidateSelectorsScript IPC. Re-exporting a second copy here would
// only suggest a single source of truth that does not exist.
import { canonicalizeHostname, toAutomationConfig } from '@shared-core/selectorConfig'
import type { AiPlatform, AiSelectorConfig } from '@shared-core/types'

import type { SelectorEntry, ValidationState } from './types'

export { toAutomationConfig }

/**
 * Identity of the selector data a validation result belongs to.
 *
 * The Settings card keeps test results in local state while the config can
 * change underneath it (a manual re-pick in another tab, a self-healing
 * promotion, a reset). Without this signature a "Test successful" panel for the
 * OLD selectors could sit next to the NEW config.
 */
export function getSelectorConfigSignature(config?: AiSelectorConfig | null): string {
  if (!config) return 'none'
  return JSON.stringify({
    input: config.input ?? null,
    button: config.button ?? null,
    inputCandidates: config.inputCandidates ?? null,
    buttonCandidates: config.buttonCandidates ?? null,
    inputFingerprint: config.inputFingerprint ?? null,
    buttonFingerprint: config.buttonFingerprint ?? null,
    submitMode: config.submitMode ?? null
  })
}

/** True when a stored validation result still describes the current config. */
export function isValidationCurrent(
  validation: ValidationState,
  config?: AiSelectorConfig | null
): boolean {
  if (validation.status === 'idle') return true
  if (!validation.configSignature) return true
  return validation.configSignature === getSelectorConfigSignature(config)
}

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
  } catch {
    return null
  }

  return null
}

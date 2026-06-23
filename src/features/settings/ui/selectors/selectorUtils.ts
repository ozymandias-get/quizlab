import { canonicalizeHostname, toAutomationConfig } from '@shared-core/selectorConfig'
import type { AiPlatform, AiSelectorConfig } from '@shared-core/types'

import type { SelectorEntry } from './types'

export { toAutomationConfig }

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

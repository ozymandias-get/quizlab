import type { AiSelectorConfig } from '@shared-core/types'

export const CONFIG_VERSION = 2
export const MAX_SELECTOR_LENGTH = 2000
export const MAX_SUBMIT_MODE_LENGTH = 64
export const MAX_URL_LENGTH = 2048
export const MAX_CANDIDATE_COUNT = 12
export const MAX_CLASS_TOKENS = 4
export const MAX_CLASS_TOKEN_LENGTH = 64
export const MAX_PATH_SEGMENTS = 8
export const MAX_SEGMENT_LENGTH = 256

/**
 * Self-healing repair metadata limits. The repair blob is attacker-reachable
 * (it arrives from the AI webview over the pipeline) and is persisted verbatim,
 * so every scalar needs an explicit bound.
 */
export const MAX_REPAIR_SELECTOR_LENGTH = 2000
export const MAX_REPAIR_SUCCESS_COUNT = 1000
export const MAX_REPAIR_CONFIDENCE_SCORE = 1000
export const MAX_REPAIR_TIMESTAMP = 4102444800000

export const HOSTNAME_REGEX = /^(?=.{1,253}$)(?!-)[\da-z-]+(\.[\da-z-]+)*$/i

export const CONFIG_KEYS = [
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
  'health',
  'repair',
  'lastRepair'
] as const satisfies readonly (keyof AiSelectorConfig)[]

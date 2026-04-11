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

export const HOSTNAME_REGEX = /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*$/i

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
  'health'
] as const satisfies readonly (keyof AiSelectorConfig)[]

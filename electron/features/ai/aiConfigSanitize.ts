/**
 * The AI selector config sanitizer: the last gate before a selector config is
 * allowed onto disk.
 *
 * It owns one decision — is this payload a config we can persist? — and answers
 * it by delegating each field to the sanitizer that understands that field's
 * shape (scalars, element fingerprints, self-healing records) and then applying
 * the reject-or-drop policy across the whole object.
 */
import type { AiSelectorConfig } from '@shared-core/types'

import {
  canonicalizeHostname,
  normalizeSelectorHealth,
  normalizeSubmitMode
} from '../../../shared/selectorConfig.js'
import { CONFIG_VERSION, MAX_SUBMIT_MODE_LENGTH } from './aiConfigConstants.js'
import { sanitizeFingerprint } from './aiConfigFingerprint.js'
import { sanitizeLastRepair, sanitizeRepairState } from './aiConfigRepairRecord.js'
import {
  normalizeHostname,
  sanitizeCssSelectors,
  sanitizeSelector,
  sanitizeSourceUrl,
  setIfDefined
} from './aiConfigScalars.js'

export { normalizeHostname }

export function sanitizeConfig(config: unknown): AiSelectorConfig | null {
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
  const repair = sanitizeRepairState(raw.repair)
  const lastRepair = sanitizeLastRepair(raw.lastRepair)

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
    (raw.health !== undefined && !health) ||
    (raw.repair !== undefined && repair === undefined) ||
    (raw.lastRepair !== undefined && lastRepair === undefined)
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
    ...setIfDefined('input', input),
    ...setIfDefined('button', button),
    ...setIfDefined('waitFor', waitFor),
    ...setIfDefined('submitMode', submitMode),
    ...setIfDefined('inputCandidates', inputCandidates),
    ...setIfDefined('buttonCandidates', buttonCandidates),
    ...setIfDefined('inputFingerprint', inputFingerprint),
    ...setIfDefined('buttonFingerprint', buttonFingerprint),
    ...setIfDefined('sourceUrl', sourceUrl),
    ...(sourceHostname ? { sourceHostname } : {}),
    ...(canonicalHostname ? { canonicalHostname } : {}),
    ...(health ? { health } : {}),
    ...setIfDefined('repair', repair),
    ...setIfDefined('lastRepair', lastRepair)
  }
}

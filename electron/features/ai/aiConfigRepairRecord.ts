/**
 * Sanitization of the persisted self-healing records: the staged candidate
 * state and the `lastRepair` promotion marker.
 *
 * These are the only fields a repair loop can write, and they are the only ones
 * that must fail *closed* on an unknown key — an unvetted field (a DOM
 * snapshot, a prompt, a cookie) must never ride along inside the persisted
 * repair record.
 */
import type {
  SelectorLastRepair,
  SelectorRepairCandidate,
  SelectorRepairKind,
  SelectorRepairState
} from '@shared-core/types'

import {
  isPersistableSelector,
  normalizeLookupStrategy
} from '../../../shared/selectorRepair/index.js'
import {
  MAX_REPAIR_CONFIDENCE_SCORE,
  MAX_REPAIR_SELECTOR_LENGTH,
  MAX_REPAIR_SUCCESS_COUNT,
  MAX_REPAIR_TIMESTAMP
} from './aiConfigConstants.js'
import { sanitizeFingerprint } from './aiConfigFingerprint.js'
import { sanitizeBoundedNumber, setIfDefined } from './aiConfigScalars.js'

/**
 * Repaired selectors go through the *same* persistence gate the runtime used to
 * decide they were promotable, so a hand-crafted IPC payload cannot smuggle a
 * marker string (`fingerprint:descriptor`, `gemini:button-fallback`, …) into
 * `input` / `button` / the candidate lists.
 */
function sanitizeRepairSelector(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  if (!isPersistableSelector(value, MAX_REPAIR_SELECTOR_LENGTH)) return undefined
  return value.trim()
}

const REPAIR_CANDIDATE_KEYS = new Set([
  'selector',
  'strategy',
  'confidenceScore',
  'confidenceLevel',
  'firstSeenAt',
  'lastSeenAt',
  'successCount',
  'consecutiveSuccessCount',
  'sourceFingerprint'
])

function sanitizeRepairCandidate(value: unknown): SelectorRepairCandidate | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const raw = value as Partial<SelectorRepairCandidate>

  // Fail closed on unknown keys: an unvetted field (a DOM snapshot, a prompt, a
  // cookie) must never ride along inside the persisted repair record.
  for (const key of Object.keys(raw)) {
    if (!REPAIR_CANDIDATE_KEYS.has(key)) return undefined
  }

  const strategy = normalizeLookupStrategy(raw.strategy)
  if (!strategy) return undefined

  const selector = sanitizeRepairSelector(raw.selector)
  if (selector === undefined) return undefined

  const confidenceScore = sanitizeBoundedNumber(raw.confidenceScore, MAX_REPAIR_CONFIDENCE_SCORE, 0)
  if (confidenceScore === undefined) return undefined

  const confidenceLevel = raw.confidenceLevel
  if (confidenceLevel !== 'high' && confidenceLevel !== 'medium' && confidenceLevel !== 'low') {
    return undefined
  }

  const firstSeenAt = sanitizeBoundedNumber(raw.firstSeenAt, MAX_REPAIR_TIMESTAMP, 0)
  const lastSeenAt = sanitizeBoundedNumber(raw.lastSeenAt, MAX_REPAIR_TIMESTAMP, 0)
  if (firstSeenAt === undefined || lastSeenAt === undefined) return undefined

  const successCount = sanitizeBoundedNumber(raw.successCount, MAX_REPAIR_SUCCESS_COUNT, 0)
  const consecutiveSuccessCount = sanitizeBoundedNumber(
    raw.consecutiveSuccessCount,
    MAX_REPAIR_SUCCESS_COUNT,
    0
  )
  if (successCount === undefined || consecutiveSuccessCount === undefined) return undefined

  const sourceFingerprint =
    raw.sourceFingerprint === undefined ? null : sanitizeFingerprint(raw.sourceFingerprint)
  if (sourceFingerprint === undefined) return undefined

  return {
    selector,
    strategy,
    confidenceScore,
    confidenceLevel,
    firstSeenAt,
    lastSeenAt,
    successCount,
    consecutiveSuccessCount,
    sourceFingerprint
  }
}

const REPAIR_KINDS: readonly SelectorRepairKind[] = ['input', 'button']

export function sanitizeRepairState(value: unknown): SelectorRepairState | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const raw = value as Record<string, unknown>
  for (const key of Object.keys(raw)) {
    if (!REPAIR_KINDS.includes(key as SelectorRepairKind)) return undefined
  }

  const next: SelectorRepairState = {}
  for (const kind of REPAIR_KINDS) {
    if (!(kind in raw)) continue
    const candidate = sanitizeRepairCandidate(raw[kind])
    if (candidate === undefined) return undefined
    next[kind] = candidate
  }

  return next
}

export function sanitizeLastRepair(value: unknown): SelectorLastRepair | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const raw = value as Partial<SelectorLastRepair>
  const repairedAt = sanitizeBoundedNumber(raw.repairedAt, MAX_REPAIR_TIMESTAMP, 0)
  if (repairedAt === undefined) return undefined

  // Only a *present* field can be invalid; an absent one simply stays absent,
  // so a record that only promoted the input stays valid.
  let inputSelector: string | null | undefined
  if (raw.inputSelector !== undefined) {
    inputSelector = sanitizeRepairSelector(raw.inputSelector)
    if (inputSelector === undefined) return undefined
  }

  let buttonSelector: string | null | undefined
  if (raw.buttonSelector !== undefined) {
    buttonSelector = sanitizeRepairSelector(raw.buttonSelector)
    if (buttonSelector === undefined) return undefined
  }

  const inputStrategy = normalizeLookupStrategy(raw.inputStrategy)
  if (raw.inputStrategy !== undefined && raw.inputStrategy !== null && !inputStrategy) {
    return undefined
  }
  const buttonStrategy = normalizeLookupStrategy(raw.buttonStrategy)
  if (raw.buttonStrategy !== undefined && raw.buttonStrategy !== null && !buttonStrategy) {
    return undefined
  }

  return {
    repairedAt,
    ...setIfDefined('inputSelector', inputSelector ?? undefined),
    ...setIfDefined('buttonSelector', buttonSelector ?? undefined),
    ...setIfDefined('inputStrategy', inputStrategy),
    ...setIfDefined('buttonStrategy', buttonStrategy)
  }
}

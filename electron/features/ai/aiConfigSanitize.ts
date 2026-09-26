import type {
  AiSelectorConfig,
  AutomationElementFingerprint,
  AutomationHostDescriptor,
  SelectorLastRepair,
  SelectorRepairCandidate,
  SelectorRepairKind,
  SelectorRepairState
} from '@shared-core/types'

import {
  canonicalizeHostname,
  normalizeSelectorHealth,
  normalizeSubmitMode
} from '../../../shared/selectorConfig.js'
import { isPersistableSelector, normalizeLookupStrategy } from '../../../shared/selectorRepair.js'
import {
  CONFIG_VERSION,
  HOSTNAME_REGEX,
  MAX_CANDIDATE_COUNT,
  MAX_CLASS_TOKEN_LENGTH,
  MAX_CLASS_TOKENS,
  MAX_PATH_SEGMENTS,
  MAX_REPAIR_CONFIDENCE_SCORE,
  MAX_REPAIR_SELECTOR_LENGTH,
  MAX_REPAIR_SUCCESS_COUNT,
  MAX_REPAIR_TIMESTAMP,
  MAX_SEGMENT_LENGTH,
  MAX_SELECTOR_LENGTH,
  MAX_SUBMIT_MODE_LENGTH,
  MAX_URL_LENGTH
} from './aiConfigConstants.js'

export function normalizeHostname(hostname: unknown): string | null {
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
    ...setIfDefined('safeId', safeId),
    ...setIfDefined('dataTestId', dataTestId),
    ...setIfDefined('classTokens', classTokens),
    ...setIfDefined('nthChild', nthChild)
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

/** Sets a key only when the value is not undefined, eliminating verbose ternary spreads. */
function setIfDefined<K extends string, V>(key: K, val: V | undefined): { [P in K]: V } | {} {
  return val !== undefined ? ({ [key]: val } as { [P in K]: V }) : {}
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
    ...setIfDefined('role', role),
    ...setIfDefined('type', type),
    ...setIfDefined('contentEditable', contentEditable),
    ...setIfDefined('text', text),
    ...setIfDefined('name', name),
    ...setIfDefined('placeholder', placeholder),
    ...setIfDefined('ariaLabel', ariaLabel),
    ...setIfDefined('dataTestId', dataTestId),
    ...setIfDefined('safeId', safeId),
    ...setIfDefined('classTokens', classTokens),
    ...setIfDefined('localPath', localPath),
    ...setIfDefined('hostChain', hostChain)
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

function sanitizeBoundedNumber(value: unknown, max: number, min: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const truncated = Math.trunc(value)
  if (truncated < min || truncated > max) return undefined
  return truncated
}

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

function sanitizeRepairState(value: unknown): SelectorRepairState | null | undefined {
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

function sanitizeLastRepair(value: unknown): SelectorLastRepair | null | undefined {
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

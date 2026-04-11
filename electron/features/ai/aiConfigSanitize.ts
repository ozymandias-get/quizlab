import {
  canonicalizeHostname,
  normalizeSelectorHealth,
  normalizeSubmitMode
} from '../../../shared/selectorConfig'
import type {
  AiSelectorConfig,
  AutomationElementFingerprint,
  AutomationHostDescriptor
} from '@shared-core/types'
import {
  CONFIG_VERSION,
  HOSTNAME_REGEX,
  MAX_CANDIDATE_COUNT,
  MAX_CLASS_TOKEN_LENGTH,
  MAX_CLASS_TOKENS,
  MAX_PATH_SEGMENTS,
  MAX_SEGMENT_LENGTH,
  MAX_SELECTOR_LENGTH,
  MAX_SUBMIT_MODE_LENGTH,
  MAX_URL_LENGTH
} from './aiConfigConstants'

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
function setIfDefined<K extends string, V>(key: K, value: V | undefined): { [P in K]: V } | {} {
  return value !== undefined ? ({ [key]: value } as { [P in K]: V }) : {}
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
    (raw.health !== undefined && !health)
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
    ...(health ? { health } : {})
  }
}

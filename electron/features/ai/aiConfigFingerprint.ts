/**
 * Sanitization of the element fingerprints the picker persists alongside a
 * selector.
 *
 * A fingerprint is attacker-reachable through the same IPC payload as the
 * config, so it is validated field by field and rebuilt from scratch: unknown
 * keys never survive because the returned object is assembled explicitly.
 */
import type { AutomationElementFingerprint, AutomationHostDescriptor } from '@shared-core/types'

import {
  MAX_CLASS_TOKEN_LENGTH,
  MAX_CLASS_TOKENS,
  MAX_PATH_SEGMENTS,
  MAX_SEGMENT_LENGTH
} from './aiConfigConstants.js'
import { sanitizeSelector, sanitizeString, setIfDefined } from './aiConfigScalars.js'

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

export function sanitizeFingerprint(
  value: unknown
): AutomationElementFingerprint | null | undefined {
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

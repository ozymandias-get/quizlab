/**
 * Scalar field normalization for a persisted AI selector config.
 *
 * Every sanitizer in this package ultimately bottoms out here: a field is either
 * absent (`undefined`), explicitly cleared (`null`) or a trimmed, length-bounded
 * value. Returning `undefined` for "present but unusable" is what lets
 * `sanitizeConfig` distinguish *drop* from *reject*.
 */
import {
  HOSTNAME_REGEX,
  MAX_CANDIDATE_COUNT,
  MAX_SELECTOR_LENGTH,
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

export function sanitizeSelector(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized || normalized.length > MAX_SELECTOR_LENGTH) return undefined
  return normalized
}

export function sanitizeString(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) return undefined
  return normalized
}

export function sanitizeCssSelectors(value: unknown): string[] | null | undefined {
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

export function sanitizeSourceUrl(value: unknown): string | null | undefined {
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

export function sanitizeBoundedNumber(
  value: unknown,
  max: number,
  min: number
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const truncated = Math.trunc(value)
  if (truncated < min || truncated > max) return undefined
  return truncated
}

/** Sets a key only when the value is not undefined, eliminating verbose ternary spreads. */
export function setIfDefined<K extends string, V>(
  key: K,
  val: V | undefined
): { [P in K]: V } | {} {
  return val !== undefined ? ({ [key]: val } as { [P in K]: V }) : {}
}

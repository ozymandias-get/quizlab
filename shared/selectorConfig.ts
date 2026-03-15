import type { SubmitMode, SelectorHealth } from './types'

const REGISTRABLE_THIRD_LEVEL_SUFFIXES = new Set(['co', 'com', 'net', 'org', 'gov', 'edu'])

const KNOWN_HOST_PREFIXES = new Set(['www', 'app', 'chat'])

export function normalizeSubmitMode(value: unknown): SubmitMode | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }

  if (normalized === 'enter' || normalized === 'enter_key') {
    return 'enter_key'
  }

  if (normalized === 'click' || normalized === 'mixed') {
    return normalized
  }

  return undefined
}

export function canonicalizeHostname(hostname: unknown): string | null {
  if (typeof hostname !== 'string') {
    return null
  }

  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!normalized) {
    return null
  }

  const labels = normalized.split('.').filter(Boolean)
  if (labels.length <= 2) {
    return normalized
  }

  const [first] = labels
  if (first && KNOWN_HOST_PREFIXES.has(first) && labels.length > 2) {
    const withoutPrefix = labels.slice(1)
    return canonicalizeHostname(withoutPrefix.join('.'))
  }

  const last = labels[labels.length - 1] || ''
  const secondLast = labels[labels.length - 2] || ''
  const thirdLast = labels[labels.length - 3] || ''

  if (
    last.length === 2 &&
    secondLast.length <= 3 &&
    REGISTRABLE_THIRD_LEVEL_SUFFIXES.has(secondLast) &&
    thirdLast
  ) {
    return labels.slice(-3).join('.')
  }

  return labels.slice(-2).join('.')
}

export function normalizeSelectorHealth(value: unknown): SelectorHealth | undefined {
  if (value === 'ready' || value === 'migrated' || value === 'needs_repick') {
    return value
  }

  return undefined
}

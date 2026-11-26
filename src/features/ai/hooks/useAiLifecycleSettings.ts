import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useLocalStorage } from '@shared/hooks'

import { useCallback, useMemo, useRef } from 'react'

/**
 * Defaults are a compatibility contract with existing users: a user who never
 * changed the sliders keeps whatever value this file resolves, and one who did
 * keeps their stored value below.
 *
 * Three warm views cover the usual "compare ChatGPT, Gemini and Claude" loop
 * without rebuilding each one on every switch. Ten minutes lets a provider
 * finish a response (and lets the user read it) before its view is retired.
 */
export const DEFAULT_MAX_ALIVE_TABS = 3
export const DEFAULT_SLEEP_TIMEOUT_MS = 10 * 60 * 1000

export const SLEEP_TIMEOUT_OPTIONS = [
  { labelKey: 'sleep_30s', value: 30 * 1000 },
  { labelKey: 'sleep_1m', value: 60 * 1000 },
  { labelKey: 'sleep_2m', value: 2 * 60 * 1000 },
  { labelKey: 'sleep_5m', value: 5 * 60 * 1000 },
  { labelKey: 'sleep_10m', value: 10 * 60 * 1000 },
  { labelKey: 'sleep_never', value: Infinity }
] as const

/** Slider range used by the settings tab. */
export const MAX_ALIVE_TABS_MIN = 1
export const MAX_ALIVE_TABS_MAX = 10

/**
 * Every value the settings tab can write. `-1` is the persisted form of
 * `Infinity` (JSON has no representation for it).
 *
 * A value stored by an older build, hand-edited storage or a corrupted settings
 * file is not allowed to reach the sleep timer or the slider: an arbitrary
 * number would make the timer fire at a moment the UI never offered and would
 * leave the selected pill without a match.
 */
const VALID_SLEEP_TIMEOUTS = new Set<number>([
  ...SLEEP_TIMEOUT_OPTIONS.map((option) => option.value),
  -1
])

function isValidMaxAliveTabs(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MAX_ALIVE_TABS_MIN &&
    value <= MAX_ALIVE_TABS_MAX
  )
}

/** Persisted values use `-1` for "never sleep"; every other value is a duration. */
function toSleepTimeoutMs(raw: unknown): number {
  if (raw === -1) return Infinity
  if (typeof raw === 'number' && VALID_SLEEP_TIMEOUTS.has(raw)) return raw
  return DEFAULT_SLEEP_TIMEOUT_MS
}

interface AiLifecycleSettingsReturn {
  maxAliveTabs: number
  sleepTimeoutMs: number
  neverSleepSiteIds: string[]
  setMaxAliveTabs: (value: number) => void
  setSleepTimeoutMs: (value: number) => void
  setNeverSleepSiteIds: (value: string[]) => void
  toggleNeverSleepSite: (siteId: string) => void
  isNeverSleepSite: (siteId: string) => boolean
}

export function useAiLifecycleSettings(): AiLifecycleSettingsReturn {
  const [storedMaxAliveTabs, setStoredMaxAliveTabs] = useLocalStorage<number>(
    STORAGE_KEYS.AI_MAX_ALIVE_TABS,
    DEFAULT_MAX_ALIVE_TABS
  )

  const [rawSleepTimeoutMs, setRawSleepTimeoutMs] = useLocalStorage<number>(
    STORAGE_KEYS.AI_SLEEP_TIMEOUT_MS,
    DEFAULT_SLEEP_TIMEOUT_MS
  )

  const setMaxAliveTabs = useCallback(
    (value: number) => {
      // Refuse to persist a value the reader would immediately replace with the
      // default: that would leave the settings screen showing one number and the
      // LRU applying another.
      if (!isValidMaxAliveTabs(value)) return
      setStoredMaxAliveTabs(value)
    },
    [setStoredMaxAliveTabs]
  )

  const setSleepTimeoutMs = useCallback(
    (value: number | ((prev: number) => number)) => {
      const resolved = typeof value === 'function' ? value(rawSleepTimeoutMs) : value
      // `Infinity` is the UI's "never sleep"; it is stored as -1. A `NaN` or any
      // other non-finite number is a caller bug, not a request to disable sleep,
      // so it falls back to the safe default instead of becoming -1.
      if (resolved === Infinity) {
        setRawSleepTimeoutMs(-1)
        return
      }
      setRawSleepTimeoutMs(
        typeof resolved === 'number' && VALID_SLEEP_TIMEOUTS.has(resolved)
          ? resolved
          : DEFAULT_SLEEP_TIMEOUT_MS
      )
    },
    [rawSleepTimeoutMs, setRawSleepTimeoutMs]
  )

  const [neverSleepSiteIds, setNeverSleepSiteIds] = useLocalStorage<string[]>(
    STORAGE_KEYS.AI_NEVER_SLEEP_SITES,
    []
  )

  const neverSleepSiteIdsRef = useRef(neverSleepSiteIds)
  neverSleepSiteIdsRef.current = neverSleepSiteIds

  const toggleNeverSleepSite = useCallback(
    (siteId: string) => {
      setNeverSleepSiteIds((prev) =>
        prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
      )
    },
    [setNeverSleepSiteIds]
  )

  // Use a ref inside the callback so the function reference stays stable.
  // Without this, every change to `neverSleepSiteIds` (e.g. toggling a
  // different site) recreates the callback, which propagates a new
  // `useAiLifecycleSettings` return value, re-rendering every AiSession
  // that consumes it — even when the sleep timer logic is unaffected.
  const isNeverSleepSite = useCallback(
    (siteId: string) => neverSleepSiteIdsRef.current.includes(siteId),
    []
  )

  const safeMaxAliveTabs = useMemo(
    () => (isValidMaxAliveTabs(storedMaxAliveTabs) ? storedMaxAliveTabs : DEFAULT_MAX_ALIVE_TABS),
    [storedMaxAliveTabs]
  )

  const sleepTimeoutMs = useMemo(() => toSleepTimeoutMs(rawSleepTimeoutMs), [rawSleepTimeoutMs])

  return useMemo(
    () => ({
      maxAliveTabs: safeMaxAliveTabs,
      sleepTimeoutMs,
      neverSleepSiteIds,
      setMaxAliveTabs,
      setSleepTimeoutMs,
      setNeverSleepSiteIds,
      toggleNeverSleepSite,
      isNeverSleepSite
    }),
    [
      safeMaxAliveTabs,
      sleepTimeoutMs,
      neverSleepSiteIds,
      setMaxAliveTabs,
      setSleepTimeoutMs,
      setNeverSleepSiteIds,
      toggleNeverSleepSite,
      isNeverSleepSite
    ]
  )
}

import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useLocalStorage } from '@shared/hooks'

import { useCallback, useMemo, useRef } from 'react'

const DEFAULT_MAX_ALIVE_TABS = 1
const DEFAULT_SLEEP_TIMEOUT_MS = 60 * 1000

export const SLEEP_TIMEOUT_OPTIONS = [
  { labelKey: 'sleep_30s', value: 30 * 1000 },
  { labelKey: 'sleep_1m', value: 60 * 1000 },
  { labelKey: 'sleep_2m', value: 2 * 60 * 1000 },
  { labelKey: 'sleep_5m', value: 5 * 60 * 1000 },
  { labelKey: 'sleep_10m', value: 10 * 60 * 1000 },
  { labelKey: 'sleep_never', value: Infinity }
] as const

export const MAX_ALIVE_TABS_OPTIONS = [1, 2, 3, 4, 5] as const

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
  const [maxAliveTabs, setMaxAliveTabs] = useLocalStorage<number>(
    STORAGE_KEYS.AI_MAX_ALIVE_TABS,
    DEFAULT_MAX_ALIVE_TABS
  )

  const [rawSleepTimeoutMs, setRawSleepTimeoutMs] = useLocalStorage<number>(
    STORAGE_KEYS.AI_SLEEP_TIMEOUT_MS,
    DEFAULT_SLEEP_TIMEOUT_MS
  )

  const setSleepTimeoutMs = useCallback(
    (value: number | ((prev: number) => number)) => {
      const resolved = value instanceof Function ? value(rawSleepTimeoutMs) : value
      setRawSleepTimeoutMs(Number.isFinite(resolved) ? resolved : -1)
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
    () => (maxAliveTabs >= 1 && maxAliveTabs <= 5 ? maxAliveTabs : DEFAULT_MAX_ALIVE_TABS),
    [maxAliveTabs]
  )

  const sleepTimeoutMs = rawSleepTimeoutMs === -1 ? Infinity : rawSleepTimeoutMs

  const safeSleepTimeoutMs = useMemo(
    () => (sleepTimeoutMs > 0 ? sleepTimeoutMs : DEFAULT_SLEEP_TIMEOUT_MS),
    [sleepTimeoutMs]
  )

  return useMemo(
    () => ({
      maxAliveTabs: safeMaxAliveTabs,
      sleepTimeoutMs: safeSleepTimeoutMs,
      neverSleepSiteIds,
      setMaxAliveTabs,
      setSleepTimeoutMs,
      setNeverSleepSiteIds,
      toggleNeverSleepSite,
      isNeverSleepSite
    }),
    [
      safeMaxAliveTabs,
      safeSleepTimeoutMs,
      neverSleepSiteIds,
      setMaxAliveTabs,
      setSleepTimeoutMs,
      setNeverSleepSiteIds,
      toggleNeverSleepSite,
      isNeverSleepSite
    ]
  )
}

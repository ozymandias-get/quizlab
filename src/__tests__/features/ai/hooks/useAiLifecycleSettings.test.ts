import {
  MAX_ALIVE_TABS_OPTIONS,
  SLEEP_TIMEOUT_OPTIONS,
  useAiLifecycleSettings
} from '@features/ai/hooks/useAiLifecycleSettings'

import { STORAGE_KEYS } from '@shared/constants/storageKeys'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const clearAiStorage = () => {
  window.localStorage.removeItem(STORAGE_KEYS.AI_MAX_ALIVE_TABS)
  window.localStorage.removeItem(STORAGE_KEYS.AI_SLEEP_TIMEOUT_MS)
  window.localStorage.removeItem(STORAGE_KEYS.AI_NEVER_SLEEP_SITES)
}

describe('useAiLifecycleSettings', () => {
  beforeEach(clearAiStorage)
  afterEach(clearAiStorage)

  it('returns safe defaults when storage is empty', () => {
    const { result } = renderHook(() => useAiLifecycleSettings())
    expect(result.current.maxAliveTabs).toBe(1)
    expect(result.current.sleepTimeoutMs).toBe(60_000)
    expect(result.current.neverSleepSiteIds).toEqual([])
    expect(result.current.isNeverSleepSite('any')).toBe(false)
  })

  it('persists maxAliveTabs and sleepTimeoutMs to storage', () => {
    const { result } = renderHook(() => useAiLifecycleSettings())

    act(() => result.current.setMaxAliveTabs(3))
    act(() => result.current.setSleepTimeoutMs(120_000))

    expect(window.localStorage.getItem(STORAGE_KEYS.AI_MAX_ALIVE_TABS)).toBe('3')
    expect(window.localStorage.getItem(STORAGE_KEYS.AI_SLEEP_TIMEOUT_MS)).toBe('120000')
  })

  it('clamps out-of-range maxAliveTabs back to default', () => {
    window.localStorage.setItem(STORAGE_KEYS.AI_MAX_ALIVE_TABS, '999')
    const { result } = renderHook(() => useAiLifecycleSettings())
    expect(result.current.maxAliveTabs).toBe(1)
  })

  it('falls back to default when sleepTimeoutMs is non-positive', () => {
    window.localStorage.setItem(STORAGE_KEYS.AI_SLEEP_TIMEOUT_MS, '0')
    const { result } = renderHook(() => useAiLifecycleSettings())
    expect(result.current.sleepTimeoutMs).toBe(60_000)
  })

  it('toggleNeverSleepSite adds and removes site ids', () => {
    const { result } = renderHook(() => useAiLifecycleSettings())

    act(() => result.current.toggleNeverSleepSite('chatgpt'))
    expect(result.current.neverSleepSiteIds).toEqual(['chatgpt'])
    expect(result.current.isNeverSleepSite('chatgpt')).toBe(true)

    act(() => result.current.toggleNeverSleepSite('claude'))
    expect(result.current.neverSleepSiteIds).toEqual(['chatgpt', 'claude'])

    act(() => result.current.toggleNeverSleepSite('chatgpt'))
    expect(result.current.neverSleepSiteIds).toEqual(['claude'])
    expect(result.current.isNeverSleepSite('chatgpt')).toBe(false)
  })

  it('setNeverSleepSiteIds replaces the list atomically', () => {
    const { result } = renderHook(() => useAiLifecycleSettings())

    act(() => result.current.setNeverSleepSiteIds(['gemini', 'perplexity']))
    expect(result.current.neverSleepSiteIds).toEqual(['gemini', 'perplexity'])
  })

  it('exposes the option lists expected by the settings UI', () => {
    expect(MAX_ALIVE_TABS_OPTIONS).toEqual([1, 2, 3, 4, 5])
    expect(SLEEP_TIMEOUT_OPTIONS).toHaveLength(6)
    expect(SLEEP_TIMEOUT_OPTIONS.find((o) => o.value === Infinity)?.labelKey).toBe('sleep_never')
  })
})

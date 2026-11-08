/**
 * Tests for src/platform/electron/api/useSettingsSystemApi.ts
 *
 * Covers app version, cache operations, and external link mutations.
 */
import {
  useAppVersion,
  useCacheInfo,
  useClearCache,
  useDeepCleanCache,
  useClearPartitionCache,
  useSetCacheAutoClean,
  useSmartCacheAction
} from '@platform/electron/api/useSettingsSystemApi'

import { getElectronApi } from '@shared/lib/electronApi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showSuccessMock = vi.fn()
const showErrorMock = vi.fn()
const tMock = vi.fn((key) => `translated_${key}`)

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(),
  hasElectronApi: vi.fn().mockReturnValue(true)
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showSuccess: showSuccessMock,
    showError: showErrorMock
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
    i18n: { language: 'en' }
  })
}))

describe('useSettingsSystemApi', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>
  let mockElectronApi: any

  beforeEach(() => {
    vi.restoreAllMocks()
    showSuccessMock.mockReset()
    showErrorMock.mockReset()
    tMock.mockClear()

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    mockElectronApi = {
      getAppVersion: vi.fn().mockResolvedValue('4.0.0'),
      clearCache: vi.fn().mockResolvedValue(true),
      deepCleanCache: vi.fn().mockResolvedValue(true),
      clearAiModelData: vi.fn().mockResolvedValue(true),
      setCacheAutoClean: vi.fn().mockResolvedValue(true),
      smartCacheAction: vi.fn().mockResolvedValue(true),
      getCacheInfo: vi.fn().mockResolvedValue({ size: 1024, entries: 10 }),
      openExternal: vi.fn().mockResolvedValue(true)
    }
    vi.mocked(getElectronApi).mockReturnValue(mockElectronApi)
  })

  it('useAppVersion should call getAppVersion', async () => {
    const { result } = renderHook(() => useAppVersion(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockElectronApi.getAppVersion).toHaveBeenCalled()
    expect(result.current.data).toBe('4.0.0')
  })

  it('useClearCache and useDeepCleanCache invalidate the info and show success', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const clear = renderHook(() => useClearCache(), { wrapper })
    await clear.result.current.mutateAsync()
    expect(mockElectronApi.clearCache).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system', 'cache-info'] })
    expect(showSuccessMock).toHaveBeenCalledWith(
      'translated_toast_cache_cleared',
      'translated_toast_system_title'
    )

    const deep = renderHook(() => useDeepCleanCache(), { wrapper })
    await deep.result.current.mutateAsync()
    expect(mockElectronApi.deepCleanCache).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system', 'cache-info'] })
    expect(showSuccessMock).toHaveBeenCalledTimes(2)
  })

  it('uses cache-only mode with the selected partition', async () => {
    const { result } = renderHook(() => useClearPartitionCache(), { wrapper })
    await result.current.mutateAsync({ partition: 'persist:ai_chatgpt' })
    expect(mockElectronApi.clearAiModelData).toHaveBeenCalledWith({
      id: 'chatgpt',
      partition: 'persist:ai_chatgpt',
      cacheOnly: true
    })
  })

  it.each([
    ['clearCache', useClearCache, undefined],
    ['deepCleanCache', useDeepCleanCache, undefined],
    ['clearAiModelData', useClearPartitionCache, { partition: 'persist:ai_chatgpt' }],
    ['setCacheAutoClean', useSetCacheAutoClean, true],
    ['smartCacheAction', useSmartCacheAction, 'clean_cold']
  ] as const)('reports %s returning false as failure', async (method, hook, argument) => {
    mockElectronApi[method].mockResolvedValue(false)
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => hook(), { wrapper })
    await expect(
      (result.current.mutateAsync as (value: unknown) => Promise<boolean>)(argument)
    ).rejects.toThrow('cache_operation_failed')
    expect(showSuccessMock).not.toHaveBeenCalled()
    expect(showErrorMock).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system', 'cache-info'] })
  })

  it('useCacheInfo should return cache info', async () => {
    const { result } = renderHook(() => useCacheInfo(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockElectronApi.getCacheInfo).toHaveBeenCalled()
    expect(result.current.data).toEqual({ size: 1024, entries: 10 })
  })

  // `useOpenExternal` is deliberately NOT tested here: this module re-exports the
  // one implementation from `useSystemApi` (see its source), which is already
  // covered by useSystemApi.test.tsx. Re-testing a re-export would only pin the
  // re-export itself.
})

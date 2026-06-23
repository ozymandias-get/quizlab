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
  useOpenExternal
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

  it('useClearCache should clear cache and show success', async () => {
    const { result } = renderHook(() => useClearCache(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await result.current.mutateAsync()
    expect(mockElectronApi.clearCache).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system', 'cache-info'] })
    expect(showSuccessMock).toHaveBeenCalledWith(
      'translated_toast_cache_cleared',
      'translated_toast_system_title'
    )
  })

  it('useDeepCleanCache should call deepCleanCache and show success', async () => {
    const { result } = renderHook(() => useDeepCleanCache(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await result.current.mutateAsync()
    expect(mockElectronApi.deepCleanCache).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system', 'cache-info'] })
    expect(showSuccessMock).toHaveBeenCalled()
  })

  it('useCacheInfo should return cache info', async () => {
    const { result } = renderHook(() => useCacheInfo(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockElectronApi.getCacheInfo).toHaveBeenCalled()
    expect(result.current.data).toEqual({ size: 1024, entries: 10 })
  })

  it('useOpenExternal should open the given URL', async () => {
    const { result } = renderHook(() => useOpenExternal(), { wrapper })
    await result.current.mutateAsync('https://example.com')
    expect(mockElectronApi.openExternal).toHaveBeenCalledWith('https://example.com')
  })
})

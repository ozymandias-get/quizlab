import {
  useAppVersion,
  useCaptureScreen,
  useCheckForUpdates,
  useClearCache,
  useCopyImageToClipboard,
  useOpenExternal
} from '@platform/electron/api/useSystemApi'

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

describe('useSystemApi', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>
  let mockElectronApi: any

  beforeEach(() => {
    vi.restoreAllMocks()
    showSuccessMock.mockReset()
    showErrorMock.mockReset()
    tMock.mockClear()

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    mockElectronApi = {
      getAppVersion: vi.fn().mockResolvedValue('4.0.0'),
      checkForUpdates: vi.fn().mockResolvedValue({ available: true, version: '4.0.1' }),
      clearCache: vi.fn().mockResolvedValue(true),
      openExternal: vi.fn().mockResolvedValue(true),
      copyImageToClipboard: vi.fn().mockResolvedValue(true),
      captureScreen: vi.fn().mockResolvedValue('img-path')
    }
    vi.mocked(getElectronApi).mockReturnValue(mockElectronApi)
  })

  it('useAppVersion should call getAppVersion', async () => {
    const { result } = renderHook(() => useAppVersion(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockElectronApi.getAppVersion).toHaveBeenCalled()
    expect(result.current.data).toBe('4.0.0')
  })

  it('useCheckForUpdates should call checkForUpdates', async () => {
    const { result } = renderHook(() => useCheckForUpdates(true), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockElectronApi.checkForUpdates).toHaveBeenCalled()
    expect(result.current.data).toEqual({ available: true, version: '4.0.1' })
  })

  it('useClearCache should clear cache, invalidate queries, and show success toast', async () => {
    const { result } = renderHook(() => useClearCache(), { wrapper })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await result.current.mutateAsync()

    expect(mockElectronApi.clearCache).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalled()
    expect(showSuccessMock).toHaveBeenCalledWith(
      'translated_toast_cache_cleared',
      'translated_toast_system_title'
    )
  })

  it('useOpenExternal should open URL', async () => {
    const { result } = renderHook(() => useOpenExternal(), { wrapper })

    await result.current.mutateAsync('https://google.com')

    expect(mockElectronApi.openExternal).toHaveBeenCalledWith('https://google.com')
  })

  it('useCopyImageToClipboard should copy data url', async () => {
    const { result } = renderHook(() => useCopyImageToClipboard(), { wrapper })

    await result.current.mutateAsync('data:image/png;base64,123')

    expect(mockElectronApi.copyImageToClipboard).toHaveBeenCalledWith('data:image/png;base64,123')
  })

  it('useCaptureScreen should take screenshot and show success toast', async () => {
    const { result } = renderHook(() => useCaptureScreen(), { wrapper })

    await result.current.mutateAsync({ x: 0, y: 0, width: 100, height: 100 })

    expect(mockElectronApi.captureScreen).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    expect(showSuccessMock).toHaveBeenCalledWith(
      'translated_toast_screenshot_captured',
      'translated_toast_system_title'
    )
  })

  it('useCaptureScreen should not show success toast when capture returns null', async () => {
    mockElectronApi.captureScreen.mockResolvedValueOnce(null)
    const { result } = renderHook(() => useCaptureScreen(), { wrapper })

    const captureResult = await result.current.mutateAsync({ x: 0, y: 0, width: 100, height: 100 })

    expect(captureResult).toBeNull()
    expect(showSuccessMock).not.toHaveBeenCalled()
  })

  it('useCaptureScreen should forward undefined rect to capture the whole page', async () => {
    const { result } = renderHook(() => useCaptureScreen(), { wrapper })

    await result.current.mutateAsync(undefined)

    expect(mockElectronApi.captureScreen).toHaveBeenCalledWith(undefined)
  })
})

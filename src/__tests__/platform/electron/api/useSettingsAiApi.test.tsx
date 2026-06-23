/**
 * Tests for src/platform/electron/api/useSettingsAiApi.ts
 *
 * Covers AI config queries and custom AI mutations.
 */
import {
  useAddCustomAi,
  useAiConfig,
  useClearAiModelData,
  useDeleteAiConfig,
  useDeleteCustomAi
} from '@platform/electron/api/useSettingsAiApi'

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

describe('useSettingsAiApi', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>
  let mockElectronApi: any

  const mockConfig = { inputSelector: 'textarea', buttonSelector: 'button' }

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
      getAiConfig: vi.fn().mockResolvedValue(mockConfig),
      deleteAiConfig: vi.fn().mockResolvedValue(true),
      addCustomAi: vi
        .fn()
        .mockResolvedValue({ ok: true, data: { platform: { name: 'CustomAI' } } }),
      deleteCustomAi: vi.fn().mockResolvedValue(true),
      clearAiModelData: vi.fn().mockResolvedValue(true)
    }
    vi.mocked(getElectronApi).mockReturnValue(mockElectronApi)
  })

  it('useAiConfig fetches config for a given hostname', async () => {
    const { result } = renderHook(() => useAiConfig('example.com'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockElectronApi.getAiConfig).toHaveBeenCalledWith('example.com')
    expect(result.current.data).toEqual(mockConfig)
  })

  it('useAiConfig fetches global config when no hostname given', async () => {
    const { result } = renderHook(() => useAiConfig(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockElectronApi.getAiConfig).toHaveBeenCalledWith(undefined)
  })

  it('useDeleteAiConfig deletes config and invalidates queries', async () => {
    const { result } = renderHook(() => useDeleteAiConfig(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await result.current.mutateAsync('example.com')
    expect(mockElectronApi.deleteAiConfig).toHaveBeenCalledWith('example.com')
    expect(invalidateSpy).toHaveBeenCalled()
    expect(showSuccessMock).toHaveBeenCalled()
  })

  it('useAddCustomAi adds custom AI and shows success', async () => {
    const { result } = renderHook(() => useAddCustomAi(), { wrapper })
    const input = { platformId: 'custom', name: 'CustomAI', url: 'https://custom.ai' }
    await result.current.mutateAsync(input as any)
    expect(mockElectronApi.addCustomAi).toHaveBeenCalledWith(input)
    expect(showSuccessMock).toHaveBeenCalledWith(
      expect.stringContaining('translated_'),
      expect.stringContaining('translated_')
    )
  })

  it('useAddCustomAi shows error when result is not ok', async () => {
    mockElectronApi.addCustomAi.mockResolvedValueOnce({
      ok: false,
      error: { message: 'Failed' }
    })
    const { result } = renderHook(() => useAddCustomAi(), { wrapper })
    const input = { platformId: 'custom', name: 'CustomAI', url: 'https://custom.ai' }
    await result.current.mutateAsync(input as any)
    expect(showErrorMock).toHaveBeenCalled()
  })

  it('useDeleteCustomAi deletes custom AI and shows success', async () => {
    const { result } = renderHook(() => useDeleteCustomAi(), { wrapper })
    await result.current.mutateAsync('custom-id')
    expect(mockElectronApi.deleteCustomAi).toHaveBeenCalledWith('custom-id')
    expect(showSuccessMock).toHaveBeenCalled()
  })

  it('useClearAiModelData clears model data and invalidates all queries', async () => {
    const { result } = renderHook(() => useClearAiModelData(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await result.current.mutateAsync({ id: 'gemini', partition: 'persist:ai_gemini' })
    expect(mockElectronApi.clearAiModelData).toHaveBeenCalledWith({
      id: 'gemini',
      partition: 'persist:ai_gemini'
    })
    expect(invalidateSpy).toHaveBeenCalled()
    expect(showSuccessMock).toHaveBeenCalled()
  })
})

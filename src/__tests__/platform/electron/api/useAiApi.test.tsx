/**
 * Tests for src/platform/electron/api/useAiApi.ts
 *
 * Covers AI registry query and save AI config mutation.
 */
import { useAiRegistry, useSaveAiConfig } from '@platform/electron/api/useAiApi'

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

describe('useAiApi', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>
  let mockElectronApi: any

  const mockRegistry = {
    platforms: [{ id: 'chatgpt', name: 'ChatGPT' }],
    custom: []
  }

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
      getAiRegistry: vi.fn().mockResolvedValue(mockRegistry),
      saveAiConfig: vi.fn().mockResolvedValue(true)
    }
    vi.mocked(getElectronApi).mockReturnValue(mockElectronApi)
  })

  it('useAiRegistry returns the AI registry', async () => {
    const { result } = renderHook(() => useAiRegistry(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockElectronApi.getAiRegistry).toHaveBeenCalledWith(false)
    expect(result.current.data).toEqual(mockRegistry)
  })

  it('useSaveAiConfig saves config and shows success', async () => {
    const { result } = renderHook(() => useSaveAiConfig(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await result.current.mutateAsync({
      hostname: 'example.com',
      config: { inputSelector: 'textarea' } as any
    })
    expect(mockElectronApi.saveAiConfig).toHaveBeenCalledWith('example.com', {
      inputSelector: 'textarea'
    })
    expect(invalidateSpy).toHaveBeenCalled()
    expect(showSuccessMock).toHaveBeenCalledWith(
      'translated_toast_ai_config_saved',
      'translated_toast_config_saved'
    )
  })

  it('useSaveAiConfig suppresses error toast when option is set', async () => {
    mockElectronApi.saveAiConfig.mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useSaveAiConfig({ suppressErrorToast: true }), { wrapper })
    await expect(
      result.current.mutateAsync({
        hostname: 'example.com',
        config: { inputSelector: 'textarea' } as any
      })
    ).rejects.toThrow()
    // Error toast should not be shown when suppressed
    expect(showErrorMock).not.toHaveBeenCalled()
  })
})

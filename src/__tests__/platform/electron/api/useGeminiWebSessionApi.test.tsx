/**
 * Tests for src/platform/electron/api/useGeminiWebSessionApi.ts
 *
 * Covers Gemini Web Session status query and action mutations.
 */
import {
  useGeminiWebResetProfile,
  useGeminiWebSetEnabled,
  useGeminiWebSetEnabledApps,
  useGeminiWebStatus
} from '@platform/electron/api/useGeminiWebSessionApi'

import { getElectronApi } from '@shared/lib/electronApi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(),
  hasElectronApi: vi.fn().mockReturnValue(true)
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn()
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => `translated_${key}` })
}))

describe('useGeminiWebSessionApi', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>
  let mockGeminiWeb: any

  beforeEach(() => {
    vi.restoreAllMocks()

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    mockGeminiWeb = {
      getStatus: vi.fn().mockResolvedValue({ loggedIn: true, profile: 'gemini' }),
      resetProfile: vi.fn().mockResolvedValue({ success: true }),
      setEnabled: vi.fn().mockResolvedValue({ success: true }),
      setEnabledApps: vi.fn().mockResolvedValue({ success: true })
    }

    vi.mocked(getElectronApi).mockReturnValue({
      geminiWeb: mockGeminiWeb
    } as any)
  })

  it('useGeminiWebStatus returns the session status', async () => {
    const { result } = renderHook(() => useGeminiWebStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGeminiWeb.getStatus).toHaveBeenCalled()
    expect(result.current.data).toEqual({ loggedIn: true, profile: 'gemini' })
  })

  const mutationCases = [
    ['useGeminiWebResetProfile', useGeminiWebResetProfile, 'resetProfile'] as const
  ]

  it.each(mutationCases)(
    '%s calls geminiWeb.%s and invalidates status',
    async (_name, useHook, method) => {
      const { result } = renderHook(() => useHook(), { wrapper })
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      await result.current.mutateAsync()
      expect(mockGeminiWeb[method] as any).toHaveBeenCalled()
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gemini-web', 'status'] })
    }
  )

  it('useGeminiWebSetEnabled calls setEnabled with the boolean', async () => {
    const { result } = renderHook(() => useGeminiWebSetEnabled(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await result.current.mutateAsync(true)
    expect(mockGeminiWeb.setEnabled).toHaveBeenCalledWith(true)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ai', 'registry'] })
  })

  it('useGeminiWebSetEnabledApps calls setEnabledApps with app IDs', async () => {
    const { result } = renderHook(() => useGeminiWebSetEnabledApps(), { wrapper })
    await result.current.mutateAsync(['gemini', 'aistudio'])
    expect(mockGeminiWeb.setEnabledApps).toHaveBeenCalledWith(['gemini', 'aistudio'])
  })
})

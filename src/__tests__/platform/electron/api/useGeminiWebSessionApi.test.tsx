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
    expect(result.current.data).toEqual({ loggedIn: true, profile: 'gemini' })
  })

  // Every action shares one seam: forward the payload to geminiWeb.<method> and
  // invalidate the status query. The two "enabled" variants additionally refresh
  // the AI registry, because the registry reads the same toggle.
  it.each([
    ['useGeminiWebResetProfile', useGeminiWebResetProfile, 'resetProfile', undefined, false],
    ['useGeminiWebSetEnabled', useGeminiWebSetEnabled, 'setEnabled', true, true],
    [
      'useGeminiWebSetEnabledApps',
      useGeminiWebSetEnabledApps,
      'setEnabledApps',
      ['gemini', 'aistudio'],
      true
    ]
  ] as const)(
    '%s forwards its payload to geminiWeb.%s and invalidates the queries it owns',
    async (_name, useHook, method, payload, invalidatesRegistry) => {
      const { result } = renderHook(() => useHook(), { wrapper })
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      await result.current.mutateAsync(payload as never)

      expect(mockGeminiWeb[method] as any).toHaveBeenCalledWith(
        ...(payload === undefined ? [] : [payload])
      )
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gemini-web', 'status'] })
      if (invalidatesRegistry) {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ai', 'registry'] })
      }
    }
  )
})

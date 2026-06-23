/**
 * Tests for src/platform/electron/api/useNativeMessagingApi.ts
 *
 * Covers native messaging extension install/remove mutations.
 * Uses raw useMutation (not useElectronMutation).
 */
import {
  useNativeMessagingInstallExtension,
  useNativeMessagingRemoveExtension
} from '@platform/electron/api/useNativeMessagingApi'

import { getElectronApi } from '@shared/lib/electronApi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn()
}))

describe('useNativeMessagingApi', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>
  let mockNativeMessaging: any

  beforeEach(() => {
    vi.restoreAllMocks()

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    mockNativeMessaging = {
      installExtension: vi.fn().mockResolvedValue(true),
      removeExtension: vi.fn().mockResolvedValue(true)
    }
  })

  it('useNativeMessagingInstallExtension calls installExtension', async () => {
    vi.mocked(getElectronApi).mockReturnValue({ nativeMessaging: mockNativeMessaging } as any)
    const { result } = renderHook(() => useNativeMessagingInstallExtension(), { wrapper })
    await result.current.mutateAsync()
    expect(mockNativeMessaging.installExtension).toHaveBeenCalled()
  })

  it('useNativeMessagingRemoveExtension calls removeExtension and invalidates', async () => {
    vi.mocked(getElectronApi).mockReturnValue({ nativeMessaging: mockNativeMessaging } as any)
    const { result } = renderHook(() => useNativeMessagingRemoveExtension(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await result.current.mutateAsync()
    expect(mockNativeMessaging.removeExtension).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['native-messaging'] })
  })

  it('throws when nativeMessaging API is not available', async () => {
    vi.mocked(getElectronApi).mockReturnValue({} as any)
    const { result } = renderHook(() => useNativeMessagingInstallExtension(), { wrapper })
    await expect(result.current.mutateAsync()).rejects.toThrow('Electron API not available')
  })
})

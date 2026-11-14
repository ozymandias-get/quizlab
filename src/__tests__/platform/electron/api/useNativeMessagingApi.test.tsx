/**
 * Tests for src/platform/electron/api/useNativeMessagingApi.ts
 *
 * Covers the pairing code query, the live status query and the extension
 * install mutation.
 */
import {
  useInstallExtensionMutation,
  useNativeMessagingPairingCodeQuery,
  useNativeMessagingStatusQuery
} from '@platform/electron/api/useNativeMessagingApi'

import { getElectronApi } from '@shared/lib/electronApi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(),
  hasElectronApi: () => true
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
      getPairingCode: vi.fn().mockResolvedValue({ code: 'a'.repeat(64) }),
      getStatus: vi.fn().mockResolvedValue({ status: 'disconnected', paired: false }),
      installExtension: vi
        .fn()
        .mockResolvedValue({ path: '/data/ext', version: '1.4.0', refreshed: true }),
      onExtensionConnected: () => () => {},
      onExtensionDisconnected: () => () => {}
    }
  })

  it('reads the pairing code when the query is enabled', async () => {
    vi.mocked(getElectronApi).mockReturnValue({ nativeMessaging: mockNativeMessaging } as any)
    const { result } = renderHook(() => useNativeMessagingPairingCodeQuery(true), { wrapper })

    await waitFor(() => expect(result.current.data).toBe('a'.repeat(64)))
    expect(mockNativeMessaging.getPairingCode).toHaveBeenCalledTimes(1)
  })

  it('does not read the pairing code while the dialog is closed', () => {
    vi.mocked(getElectronApi).mockReturnValue({ nativeMessaging: mockNativeMessaging } as any)
    renderHook(() => useNativeMessagingPairingCodeQuery(false), { wrapper })

    expect(mockNativeMessaging.getPairingCode).not.toHaveBeenCalled()
  })

  it('reports no status when the native messaging API is not available', async () => {
    vi.mocked(getElectronApi).mockReturnValue({} as any)
    const { result } = renderHook(() => useNativeMessagingStatusQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('prepares the bundled extension through the main process', async () => {
    vi.mocked(getElectronApi).mockReturnValue({ nativeMessaging: mockNativeMessaging } as any)
    const { result } = renderHook(() => useInstallExtensionMutation(), { wrapper })

    let installed: { path: string } | undefined
    await act(async () => {
      installed = await result.current.mutateAsync()
    })

    expect(installed).toEqual({ path: '/data/ext', version: '1.4.0', refreshed: true })
    expect(mockNativeMessaging.installExtension).toHaveBeenCalledTimes(1)
  })

  it('reports an error when the native messaging API is not available', async () => {
    vi.mocked(getElectronApi).mockReturnValue({} as any)
    const { result } = renderHook(() => useInstallExtensionMutation(), { wrapper })

    await expect(result.current.mutateAsync()).rejects.toThrow('Electron API not available')
  })
})

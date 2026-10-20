/**
 * Tests for src/platform/electron/api/useSiteSessionApi.ts
 *
 * Covers the list query, the change event that refreshes it and the two
 * actions the settings page offers.
 */
import {
  SITE_SESSION_LIST_KEY,
  useClearSiteSessionMutation,
  useSetSiteSessionEnabledMutation,
  useSiteSessionListQuery
} from '@platform/electron/api/useSiteSessionApi'

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

const LIST_RESULT = {
  views: [],
  extensionConnected: true,
  extensionVersionOk: true
}

describe('useSiteSessionApi', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>
  let mockSiteSession: any
  let onChanged: (() => void) | null

  beforeEach(() => {
    vi.restoreAllMocks()

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    onChanged = null
    mockSiteSession = {
      list: vi.fn().mockResolvedValue(LIST_RESULT),
      setEnabled: vi.fn().mockResolvedValue({ success: true }),
      clear: vi.fn().mockResolvedValue({ success: true }),
      onChanged: vi.fn((callback: () => void) => {
        onChanged = callback
        return () => {}
      })
    }

    vi.mocked(getElectronApi).mockReturnValue({
      siteSession: mockSiteSession
    } as any)
  })

  it('reads the sites from the main process', async () => {
    const { result } = renderHook(() => useSiteSessionListQuery(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(LIST_RESULT)
  })

  it('refetches the list when the main process says that it changed', async () => {
    const { result } = renderHook(() => useSiteSessionListQuery(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    onChanged?.()

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })

  it('turns a site on and refreshes the list', async () => {
    const { result } = renderHook(() => useSetSiteSessionEnabledMutation(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await result.current.mutateAsync({ siteId: 'chatgpt', enabled: true })

    expect(mockSiteSession.setEnabled).toHaveBeenCalledWith('chatgpt', true)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })

  it('clears a session and refreshes the list', async () => {
    const { result } = renderHook(() => useClearSiteSessionMutation(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await result.current.mutateAsync({ siteId: 'chatgpt' })

    expect(mockSiteSession.clear).toHaveBeenCalledWith('chatgpt')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })

  it('reports a failed action to the caller and refreshes the list', async () => {
    mockSiteSession.setEnabled.mockResolvedValue({ success: false, error: 'write_failed' })
    const { result } = renderHook(() => useSetSiteSessionEnabledMutation(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const outcome = await result.current.mutateAsync({ siteId: 'chatgpt', enabled: true })

    expect(outcome).toEqual({ success: false, error: 'write_failed' })
    // The switch may have been written before the action failed, so the row
    // has to be read again.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })
})

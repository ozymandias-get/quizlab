import type { GeminiWebSessionActionResult, GeminiWebSessionRefreshEvent } from '@shared-core/types'

import { useGeminiWebSessionState } from '@features/settings/ui/geminiWebSession/useGeminiWebSessionState'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockShowError = vi.fn()
const mockRefetch = vi.fn().mockResolvedValue(undefined)
const mockResetProfile = vi.fn<() => Promise<GeminiWebSessionActionResult>>()
const mockSetEnabled = vi.fn<(enabled: boolean) => Promise<GeminiWebSessionActionResult>>()
const mockSetEnabledApps =
  vi.fn<(enabledAppIds: string[]) => Promise<GeminiWebSessionActionResult>>()
const mockUseGeminiWebStatus = vi.fn()
const mockOnRefreshEvent =
  vi.fn<(callback: (event: GeminiWebSessionRefreshEvent) => void) => () => void>()

const translations: Record<string, string> = {
  error_unknown_error: 'unknown-error',
  gws_feature_disabled: 'feature-disabled',
  gws_state_disabled: 'disabled',
  gws_state_authenticated: 'authenticated',
  gws_state_reauth_required: 'reauth-required',
  gws_state_degraded: 'degraded',
  gws_state_auth_required: 'auth-required',
  gws_state_refreshing: 'refreshing',
  gws_reason_none: 'No reason',
  gws_reason_login_redirect: 'Login redirect',
  gws_refresh_reason_http_401: '401',
  gws_refresh_reason_login_redirect: 'redirect',
  gws_risk_unofficial: 'risk-1',
  gws_risk_challenge: 'risk-2',
  gws_risk_expiry: 'risk-3',
  gws_risk_profile_access: 'risk-4',
  gws_risk_behavior_changes: 'risk-5',
  gws_risk_multi_device: 'risk-6',
  gws_mitigation_dedicated_profile: 'mitigation-1',
  gws_mitigation_stable_network: 'mitigation-2',
  gws_mitigation_manual_reauth: 'mitigation-3',
  gws_mitigation_no_shared_machine: 'mitigation-4'
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
    i18n: { language: 'tr' }
  })
}))

vi.mock('@app/providers', () => ({
  useToastActions: () => ({
    showError: mockShowError
  }),
  useAppToolFlagsState: () => ({}),
  useAppToolActions: () => ({})
}))

vi.mock('@platform/electron/api/useGeminiWebSessionApi', () => ({
  GEMINI_WEB_REQUIRES_LOGIN_ERROR: 'error_refresh_failed_requires_login',
  useGeminiWebStatus: (...args: unknown[]) => mockUseGeminiWebStatus(...args),
  useGeminiWebResetProfile: () => ({
    mutateAsync: mockResetProfile,
    isPending: false
  }),
  useGeminiWebSetEnabled: () => ({
    mutateAsync: mockSetEnabled,
    isPending: false
  }),
  useGeminiWebSetEnabledApps: () => ({
    mutateAsync: mockSetEnabledApps,
    isPending: false
  })
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => ({
    geminiWeb: {
      onRefreshEvent: mockOnRefreshEvent
    }
  })
}))

describe('useGeminiWebSessionState', () => {
  let refreshCallback: ((event: GeminiWebSessionRefreshEvent) => void) | undefined
  let unsubscribe: () => void

  const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient()
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    unsubscribe = vi.fn()
    refreshCallback = undefined
    mockOnRefreshEvent.mockImplementation((callback) => {
      refreshCallback = callback
      return unsubscribe
    })
    mockUseGeminiWebStatus.mockReturnValue({
      data: {
        state: 'authenticated',
        reasonCode: 'none',
        featureEnabled: true,
        enabled: true,
        enabledAppIds: ['gemini'],
        lastHealthyAt: null,
        lastCheckAt: '2026-04-08T10:00:00.000Z',
        consecutiveFailures: 0
      },
      isLoading: false,
      isRefetching: false,
      refetch: mockRefetch
    })
    mockResetProfile.mockResolvedValue({ success: true })
    mockSetEnabled.mockResolvedValue({ success: true })
    mockSetEnabledApps.mockResolvedValue({ success: true })
  })

  it('subscribes to refresh events and cleans up on unmount', () => {
    const { unmount } = renderHook(() => useGeminiWebSessionState(), { wrapper })

    expect(mockUseGeminiWebStatus).toHaveBeenCalledWith()
    expect(mockOnRefreshEvent).toHaveBeenCalledTimes(1)

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('tracks started and success refresh events inline', async () => {
    const { result } = renderHook(() => useGeminiWebSessionState(), { wrapper })

    act(() => {
      refreshCallback?.({ phase: 'started', reason: 'http_401' })
    })

    expect(result.current.status.isRefreshing).toBe(true)
    expect(result.current.status.lastRefreshReason).toBe('http_401')
    expect(result.current.stateText).toBe('refreshing')

    act(() => {
      refreshCallback?.({ phase: 'success', reason: 'http_401' })
    })

    await waitFor(() => {
      expect(result.current.status.isRefreshing).toBe(false)
    })
    expect(result.current.status.lastRefreshedAt).not.toBeNull()
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('tracks started and failed refresh events inline', async () => {
    const { result } = renderHook(() => useGeminiWebSessionState(), { wrapper })

    act(() => {
      refreshCallback?.({ phase: 'started', reason: 'http_401' })
    })

    expect(result.current.status.isRefreshing).toBe(true)
    expect(result.current.stateText).toBe('refreshing')

    act(() => {
      refreshCallback?.({
        phase: 'failed',
        reason: 'login_redirect',
        error: 'error_refresh_failed_requires_login'
      })
    })

    await waitFor(() => {
      expect(result.current.status.isRefreshing).toBe(false)
    })
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('rolls back enabled apps when managed app update fails', async () => {
    mockSetEnabledApps.mockResolvedValue({
      success: false,
      error: 'failed_to_save'
    })

    const { result } = renderHook(() => useGeminiWebSessionState(), { wrapper })

    expect(result.current.enabledAppIds.has('gemini')).toBe(true)

    await act(async () => {
      result.current.handlers.onToggleManagedApp('gemini')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.enabledAppIds.has('gemini')).toBe(true)
    })
  })
})

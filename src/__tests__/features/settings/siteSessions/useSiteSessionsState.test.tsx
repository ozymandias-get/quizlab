import type { SiteSessionView } from '@shared-core/types/siteSession'

import { useSiteSessionsState } from '@features/settings/ui/siteSessions/useSiteSessionsState'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const CHATGPT_VIEW: SiteSessionView = {
  siteId: 'chatgpt',
  labelKey: 'ws_target_chatgpt',
  hostname: 'chatgpt.com',
  kind: 'builtin',
  memberAppIds: ['chatgpt'],
  enabled: false,
  status: 'signed_out',
  importedAt: null,
  lastError: null
}

const GOOGLE_VIEW: SiteSessionView = {
  siteId: 'google',
  labelKey: 'ws_target_google',
  hostname: 'accounts.google.com',
  kind: 'google',
  memberAppIds: ['gemini'],
  enabled: true,
  status: 'imported',
  importedAt: '2026-04-08T10:00:00.000Z',
  lastError: null
}

let mockViews: SiteSessionView[] = []

const mockSetEnabled = vi.fn()
const mockClear = vi.fn()
const mockShowError = vi.fn()

vi.mock('@platform/electron/api/useSiteSessionApi', () => ({
  useSiteSessionListQuery: () => ({
    data: { views: mockViews, extensionConnected: true, extensionVersionOk: true },
    isLoading: false
  }),
  useSetSiteSessionEnabledMutation: () => ({
    mutateAsync: mockSetEnabled,
    isPending: false
  }),
  useClearSiteSessionMutation: () => ({
    mutateAsync: mockClear,
    isPending: false
  })
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({ showError: mockShowError })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

describe('useSiteSessionsState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockViews = [CHATGPT_VIEW, GOOGLE_VIEW]
    mockSetEnabled.mockResolvedValue({ success: true })
    mockClear.mockResolvedValue({ success: true })
  })

  it('turns the import of a site on', async () => {
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onToggle('chatgpt')
      await Promise.resolve()
    })

    expect(mockSetEnabled).toHaveBeenCalledWith({ siteId: 'chatgpt', enabled: true })
  })

  it('turns the import of a site off', async () => {
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onToggle('google')
      await Promise.resolve()
    })

    expect(mockSetEnabled).toHaveBeenCalledWith({ siteId: 'google', enabled: false })
  })

  it('tells the user why a switch did not change', async () => {
    mockSetEnabled.mockResolvedValue({ success: false, error: 'write_failed' })

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onToggle('chatgpt')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('ws_error_write_failed')
    })
  })

  it('clears the session of every site whose import is on', async () => {
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onClearAll()
      await Promise.resolve()
    })

    expect(mockClear).toHaveBeenCalledTimes(1)
    expect(mockClear).toHaveBeenCalledWith({ siteId: 'google' })
  })

  it('has nothing to clear when no site imports a session', async () => {
    mockViews = [CHATGPT_VIEW]

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onClearAll()
      await Promise.resolve()
    })

    expect(mockClear).not.toHaveBeenCalled()
  })
})

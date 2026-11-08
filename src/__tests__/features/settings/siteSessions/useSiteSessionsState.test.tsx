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
const mockShowSuccess = vi.fn()
const mockShowWarning = vi.fn()
const mockConfirm = vi.fn()

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
  useToastActions: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
    showWarning: mockShowWarning
  })
}))

vi.mock('@shared/hooks', () => ({
  useConfirmDialog: () => ({
    confirm: mockConfirm,
    props: { isOpen: false, onConfirm: vi.fn(), onCancel: vi.fn(), title: '' }
  })
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
    mockConfirm.mockResolvedValue(true)
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
      await result.current.onClearAll()
    })

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockClear).toHaveBeenCalledTimes(1)
    expect(mockClear).toHaveBeenCalledWith({ siteId: 'google' })
    expect(mockShowSuccess).toHaveBeenCalledWith('ws_clear_all_result_success', undefined, {
      count: '1'
    })
  })

  it('summarises a partial failure and retries only the failed sites', async () => {
    mockViews = [GOOGLE_VIEW, { ...CHATGPT_VIEW, enabled: true }]
    mockClear.mockImplementation(({ siteId }: { siteId: string }) =>
      siteId === 'chatgpt'
        ? Promise.resolve({ success: false, error: 'wipe_failed' })
        : Promise.resolve({ success: true })
    )

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      await result.current.onClearAll()
    })

    expect(mockShowWarning).toHaveBeenCalledTimes(1)
    expect(mockShowWarning.mock.calls[0][0]).toBe('ws_clear_all_result_partial')
    expect(mockShowWarning.mock.calls[0][2]).toEqual({
      success: '1',
      failed: '1',
      sites: 'ws_target_chatgpt'
    })
    expect(result.current.failedClearSites.map((view) => view.siteId)).toEqual(['chatgpt'])

    mockClear.mockClear()
    mockClear.mockResolvedValue({ success: true })
    await act(async () => {
      await result.current.onRetryFailedClear()
    })

    expect(mockClear).toHaveBeenCalledTimes(1)
    expect(mockClear).toHaveBeenCalledWith({ siteId: 'chatgpt' })
    expect(result.current.failedClearSites).toHaveLength(0)
  })

  it('sends only one request for a switch that is clicked twice', async () => {
    let resolveToggle: (value: { success: boolean }) => void = () => undefined
    mockSetEnabled.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveToggle = resolve
      })
    )

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onToggle('chatgpt')
      result.current.onToggle('chatgpt')
      await Promise.resolve()
    })

    expect(mockSetEnabled).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveToggle({ success: true })
    })
  })

  it('skips a failed-clear retry for a site whose import was turned off', async () => {
    mockViews = [GOOGLE_VIEW, { ...CHATGPT_VIEW, enabled: true }]
    mockClear.mockImplementation(({ siteId }: { siteId: string }) =>
      siteId === 'chatgpt'
        ? Promise.resolve({ success: false, error: 'wipe_failed' })
        : Promise.resolve({ success: true })
    )

    const { result, rerender } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      await result.current.onClearAll()
    })
    expect(result.current.failedClearSites.map((view) => view.siteId)).toEqual(['chatgpt'])

    // The user turned the import off while looking at the failure.
    mockViews = [GOOGLE_VIEW, CHATGPT_VIEW]
    rerender()
    mockClear.mockClear()

    await act(async () => {
      await result.current.onRetryFailedClear()
    })

    expect(mockClear).not.toHaveBeenCalled()
    expect(result.current.failedClearSites).toHaveLength(0)
  })

  it('drops a site from the clear run when its import was turned off during confirmation', async () => {
    let resolveConfirm: (value: boolean) => void = () => undefined
    mockConfirm.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveConfirm = resolve
      })
    )
    mockViews = [GOOGLE_VIEW, { ...CHATGPT_VIEW, enabled: true }]

    const { result, rerender } = renderHook(() => useSiteSessionsState(), { wrapper })

    act(() => {
      void result.current.onClearAll()
    })
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1))

    // While the dialog is open, the user turns the ChatGPT import back off.
    mockViews = [GOOGLE_VIEW, CHATGPT_VIEW]
    rerender()

    await act(async () => {
      resolveConfirm(true)
    })

    expect(mockClear).toHaveBeenCalledTimes(1)
    expect(mockClear).toHaveBeenCalledWith({ siteId: 'google' })
  })

  it('does not clear anything when the confirmation is dismissed', async () => {
    mockConfirm.mockResolvedValue(false)

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      await result.current.onClearAll()
    })

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockClear).not.toHaveBeenCalled()
  })

  it('has nothing to clear when no site imports a session', async () => {
    mockViews = [CHATGPT_VIEW]

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      await result.current.onClearAll()
    })

    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockClear).not.toHaveBeenCalled()
  })
})

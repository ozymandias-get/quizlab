import type { SiteSessionAccountView, SiteSessionSiteView } from '@shared-core/types/siteSession'

import { useSiteSessionsState } from '@features/settings/ui/siteSessions/useSiteSessionsState'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const CHATGPT_ACCOUNT: SiteSessionAccountView = {
  accountId: 'primary',
  name: null,
  index: 1,
  enabled: false,
  status: 'signed_out',
  importedAt: null,
  lastError: null,
  isActive: false,
  isPrimary: true
}

const GOOGLE_ACCOUNT: SiteSessionAccountView = {
  accountId: 'a1',
  name: 'Kisisel',
  index: 2,
  enabled: true,
  status: 'imported',
  importedAt: '2026-04-08T10:00:00.000Z',
  lastError: null,
  isActive: true,
  isPrimary: false
}

/** One site with the accounts it holds. */
const siteWith = (siteId: string, accounts: SiteSessionAccountView[]): SiteSessionSiteView => ({
  siteId,
  labelKey: 'ws_target_chatgpt',
  hostname: 'chatgpt.com',
  kind: 'builtin',
  memberAppIds: ['chatgpt'],
  accounts,
  activeAccountId: null,
  attributedAccountId: null,
  hasPendingSession: false
})

let mockSites: SiteSessionSiteView[] = []

const mockSetEnabled = vi.fn()
const mockClear = vi.fn()
const mockSetActive = vi.fn()
const mockRename = vi.fn()
const mockDelete = vi.fn()
const mockResolve = vi.fn()
const mockReAsk = vi.fn()
const mockShowError = vi.fn()
const mockShowWarning = vi.fn()
const mockShowInfo = vi.fn()

vi.mock('@platform/electron/api/useSiteSessionApi', () => ({
  useSiteSessionListQuery: () => ({
    data: { accountViews: mockSites, extensionConnected: true, extensionVersionOk: true },
    isLoading: false
  }),
  useSetSiteSessionEnabledMutation: () => ({
    mutateAsync: mockSetEnabled,
    isPending: false
  }),
  useClearSiteSessionMutation: () => ({
    mutateAsync: mockClear,
    isPending: false
  }),
  useSetSiteSessionActiveAccountMutation: () => ({
    mutateAsync: mockSetActive,
    isPending: false
  }),
  useRenameSiteSessionAccountMutation: () => ({
    mutateAsync: mockRename,
    isPending: false
  }),
  useDeleteSiteSessionAccountMutation: () => ({
    mutateAsync: mockDelete,
    isPending: false
  }),
  useResolveSiteSessionPendingMutation: () => ({
    mutateAsync: mockResolve,
    isPending: false
  }),
  useSetSiteSessionAttributionMutation: () => ({
    mutateAsync: mockReAsk,
    isPending: false
  })
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showError: mockShowError,
    showWarning: mockShowWarning,
    showInfo: mockShowInfo
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
    mockSites = [
      siteWith('chatgpt', [CHATGPT_ACCOUNT]),
      siteWith('google', [CHATGPT_ACCOUNT, GOOGLE_ACCOUNT])
    ]
    mockSetEnabled.mockResolvedValue({ success: true })
    mockClear.mockResolvedValue({ success: true })
    mockSetActive.mockResolvedValue({ success: true })
    mockRename.mockResolvedValue({ success: true })
    mockDelete.mockResolvedValue({ success: true })
    mockResolve.mockResolvedValue({ success: true })
    mockReAsk.mockResolvedValue({ success: true })
  })

  it('turns the import of an account on', async () => {
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onToggle('chatgpt', 'primary')
      await Promise.resolve()
    })

    expect(mockSetEnabled).toHaveBeenCalledWith({
      siteId: 'chatgpt',
      accountId: 'primary',
      enabled: true
    })
  })

  it('turns the import of an account off', async () => {
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onToggle('google', 'a1')
      await Promise.resolve()
    })

    expect(mockSetEnabled).toHaveBeenCalledWith({
      siteId: 'google',
      accountId: 'a1',
      enabled: false
    })
  })

  it('tells the user why a switch did not change', async () => {
    mockSetEnabled.mockResolvedValue({ success: false, error: 'write_failed' })

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onToggle('chatgpt', 'primary')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('ws_error_write_failed')
    })
  })

  it('clears the session of every account whose import is on', async () => {
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onClearAll()
      await Promise.resolve()
    })

    expect(mockClear).toHaveBeenCalledTimes(1)
    expect(mockClear).toHaveBeenCalledWith({ siteId: 'google', accountId: 'a1' })
  })

  it('has nothing to clear when no account imports a session', async () => {
    mockSites = [siteWith('chatgpt', [CHATGPT_ACCOUNT])]

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onClearAll()
      await Promise.resolve()
    })

    expect(mockClear).not.toHaveBeenCalled()
  })

  it('marks the account the panels of the site open with', async () => {
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onSetActive('google', 'a1')
      await Promise.resolve()
    })

    expect(mockSetActive).toHaveBeenCalledWith({ siteId: 'google', accountId: 'a1' })
  })

  it('gives an account the name of the user', async () => {
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onRename('google', 'a1', 'Is')
      await Promise.resolve()
    })

    expect(mockRename).toHaveBeenCalledWith({ siteId: 'google', accountId: 'a1', name: 'Is' })
  })

  it('tells the user that a name is already taken', async () => {
    mockRename.mockResolvedValue({ success: false, error: 'duplicate_name' })

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onRename('google', 'a1', 'Is')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('ws_error_duplicate_name')
    })
  })

  it('removes an account', async () => {
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onDelete('google', 'a1')
      await Promise.resolve()
    })

    expect(mockDelete).toHaveBeenCalledWith({ siteId: 'google', accountId: 'a1' })
  })

  it('reports a deleted account whose folder stayed behind as information', async () => {
    // The account is gone; only its folder is left. That is not an error the
    // user has to act on, so it is not shown as one.
    mockDelete.mockResolvedValue({ success: false, error: 'folder_delete_failed' })

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onDelete('google', 'a1')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(mockShowInfo).toHaveBeenCalledWith('ws_error_folder_delete_failed')
    })
    expect(mockShowError).not.toHaveBeenCalled()
  })

  it('reports a switch that was written but could not wipe the session as a warning', async () => {
    // Half of the action happened: the account is switched off, but the
    // session it held is still there. That is a warning, not a plain failure.
    mockSetEnabled.mockResolvedValue({ success: false, error: 'switch_off_wipe_failed' })

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onToggle('google', 'a1')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(mockShowWarning).toHaveBeenCalledWith('ws_error_switch_off_wipe_failed')
    })
    expect(mockShowError).not.toHaveBeenCalled()
  })

  it('writes a pending session into the account the user picked', async () => {
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onResolvePending('google', 'a1')
      await Promise.resolve()
    })

    expect(mockResolve).toHaveBeenCalledWith({ siteId: 'google', accountId: 'a1' })
  })

  it('writes a pending session into a new account', async () => {
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onResolvePending('google', null)
      await Promise.resolve()
    })

    expect(mockResolve).toHaveBeenCalledWith({ siteId: 'google', accountId: null })
  })

  it('clears the attribution so the question comes back', async () => {
    // The extension polls the config version: the cleared attribution makes it
    // push every site again, and the card asks about the held session once more.
    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onReAskAttribution('google')
      await Promise.resolve()
    })

    expect(mockReAsk).toHaveBeenCalledWith({ siteId: 'google', accountId: null })
  })

  it('reports a re-ask that was refused', async () => {
    mockReAsk.mockResolvedValue({ success: false, error: 'write_failed' })

    const { result } = renderHook(() => useSiteSessionsState(), { wrapper })

    await act(async () => {
      result.current.onReAskAttribution('google')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('ws_error_write_failed')
    })
  })
})

/**
 * Tests for src/platform/electron/api/useSiteSessionApi.ts
 *
 * Covers the list query, the change event that refreshes it and every account
 * action the settings page and the panel offer. Each action test pins the
 * renderer method it calls and the arguments it passes, so the hooks cannot
 * drift away from the `siteSession` surface (and therefore from the channel the
 * preload binds the method to).
 */
import type {
  SiteSessionAccountView,
  SiteSessionListResult,
  SiteSessionSiteView
} from '@shared-core/types/siteSession'

import {
  hasEnabledSiteSession,
  hasSiteSessionNeedingAttention,
  SITE_SESSION_LIST_KEY,
  useClearSiteSessionMutation,
  useDeleteSiteSessionAccountMutation,
  useRenameSiteSessionAccountMutation,
  useResolveSiteSessionPendingMutation,
  useSetSiteSessionActiveAccountMutation,
  useSetSiteSessionAttributionMutation,
  useSetSiteSessionEnabledMutation,
  useSiteSessionListQuery
} from '@platform/electron/api/useSiteSessionApi'

import { PRIMARY_ACCOUNT_ID } from '@shared-core/types/siteSession'
import { getElectronApi } from '@shared/lib/electronApi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

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

const LIST_RESULT: SiteSessionListResult = {
  accountViews: [],
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
      setAccountEnabled: vi.fn().mockResolvedValue({ success: true }),
      clearAccount: vi.fn().mockResolvedValue({ success: true }),
      setActiveAccount: vi.fn().mockResolvedValue({ success: true }),
      renameAccount: vi.fn().mockResolvedValue({ success: true }),
      deleteAccount: vi.fn().mockResolvedValue({ success: true }),
      resolvePending: vi.fn().mockResolvedValue({ success: true }),
      setAttributedAccount: vi.fn().mockResolvedValue({ success: true }),
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

  it('turns the switch of one account and refreshes the list', async () => {
    const { result } = renderHook(() => useSetSiteSessionEnabledMutation(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await result.current.mutateAsync({ siteId: 'chatgpt', accountId: 'account-2', enabled: true })

    expect(mockSiteSession.setAccountEnabled).toHaveBeenCalledWith('chatgpt', 'account-2', true)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })

  it('requires the account the switch belongs to', () => {
    // The old settings card named no account and silently targeted the
    // primary one. Every account has its own switch now, so omitting the
    // account is a mistake the type has to catch.
    const { result } = renderHook(() => useSetSiteSessionEnabledMutation(), { wrapper })

    expectTypeOf(result.current.mutateAsync).parameter(0).toEqualTypeOf<{
      siteId: string
      accountId: string
      enabled: boolean
    }>()
  })

  it('clears one account and refreshes the list', async () => {
    const { result } = renderHook(() => useClearSiteSessionMutation(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await result.current.mutateAsync({ siteId: 'chatgpt', accountId: 'account-2' })

    expect(mockSiteSession.clearAccount).toHaveBeenCalledWith('chatgpt', 'account-2')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })

  it('requires the account the clear belongs to', () => {
    const { result } = renderHook(() => useClearSiteSessionMutation(), { wrapper })

    expectTypeOf(result.current.mutateAsync).parameter(0).toEqualTypeOf<{
      siteId: string
      accountId: string
    }>()
  })

  it('marks one account as the active account and refreshes the list', async () => {
    const { result } = renderHook(() => useSetSiteSessionActiveAccountMutation(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await result.current.mutateAsync({ siteId: 'chatgpt', accountId: 'account-2' })

    expect(mockSiteSession.setActiveAccount).toHaveBeenCalledWith('chatgpt', 'account-2')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })

  it('renames one account and refreshes the list', async () => {
    const { result } = renderHook(() => useRenameSiteSessionAccountMutation(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await result.current.mutateAsync({ siteId: 'chatgpt', accountId: 'account-2', name: 'Work' })

    expect(mockSiteSession.renameAccount).toHaveBeenCalledWith('chatgpt', 'account-2', 'Work')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })

  it('deletes one account and refreshes the list', async () => {
    const { result } = renderHook(() => useDeleteSiteSessionAccountMutation(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await result.current.mutateAsync({ siteId: 'chatgpt', accountId: 'account-2' })

    expect(mockSiteSession.deleteAccount).toHaveBeenCalledWith('chatgpt', 'account-2')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })

  it('resolves a pending session into the selected account and refreshes the list', async () => {
    const { result } = renderHook(() => useResolveSiteSessionPendingMutation(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await result.current.mutateAsync({ siteId: 'chatgpt', accountId: 'account-2' })

    expect(mockSiteSession.resolvePending).toHaveBeenCalledWith('chatgpt', 'account-2')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })

  it('resolves a pending session into a new account when no account is named', async () => {
    const { result } = renderHook(() => useResolveSiteSessionPendingMutation(), { wrapper })

    await result.current.mutateAsync({ siteId: 'chatgpt', accountId: null })

    expect(mockSiteSession.resolvePending).toHaveBeenCalledWith('chatgpt', null)
  })

  it('attributes a held session to the account the user named and refreshes the list', async () => {
    const { result } = renderHook(() => useSetSiteSessionAttributionMutation(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await result.current.mutateAsync({ siteId: 'chatgpt', accountId: 'account-2' })

    expect(mockSiteSession.setAttributedAccount).toHaveBeenCalledWith('chatgpt', 'account-2')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })

  it('asks the app to name the account of the next held session again', async () => {
    const { result } = renderHook(() => useSetSiteSessionAttributionMutation(), { wrapper })

    await result.current.mutateAsync({ siteId: 'chatgpt', accountId: null })

    expect(mockSiteSession.setAttributedAccount).toHaveBeenCalledWith('chatgpt', null)
  })

  it('reports a failed action to the caller and refreshes the list', async () => {
    mockSiteSession.setAccountEnabled.mockResolvedValue({
      success: false,
      error: 'write_failed'
    })
    const { result } = renderHook(() => useSetSiteSessionEnabledMutation(), { wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const outcome = await result.current.mutateAsync({
      siteId: 'chatgpt',
      accountId: 'account-2',
      enabled: true
    })

    expect(outcome).toEqual({ success: false, error: 'write_failed' })
    // The switch may have been written before the action failed, so the row
    // has to be read again.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SITE_SESSION_LIST_KEY })
  })
})

describe('the site session helpers', () => {
  const account = (overrides: Partial<SiteSessionAccountView> = {}): SiteSessionAccountView => ({
    accountId: PRIMARY_ACCOUNT_ID,
    name: null,
    index: 1,
    enabled: false,
    status: 'signed_out',
    importedAt: null,
    lastError: null,
    isActive: false,
    isPrimary: true,
    ...overrides
  })

  const secondAccount = (overrides: Partial<SiteSessionAccountView> = {}) =>
    account({ accountId: 'account-2', index: 2, isPrimary: false, ...overrides })

  const site = (overrides: Partial<SiteSessionSiteView> = {}): SiteSessionSiteView => ({
    siteId: 'chatgpt',
    labelKey: 'ws_target_chatgpt',
    hostname: 'chatgpt.com',
    kind: 'builtin',
    memberAppIds: ['chatgpt'],
    accounts: [account()],
    activeAccountId: null,
    attributedAccountId: null,
    hasPendingSession: false,
    ...overrides
  })

  it('knows that an account of a site pulls its session from Chrome', () => {
    expect(hasEnabledSiteSession([site()])).toBe(false)
    expect(
      hasEnabledSiteSession([site({ accounts: [account(), secondAccount({ enabled: true })] })])
    ).toBe(true)
  })

  it('asks for attention when Chrome has no session for an enabled account', () => {
    expect(
      hasSiteSessionNeedingAttention([
        site({ accounts: [account({ enabled: true, status: 'no_cookies_in_browser' })] })
      ])
    ).toBe(true)
  })

  it('asks for attention when the extension or the permission is missing', () => {
    expect(
      hasSiteSessionNeedingAttention([
        site({ accounts: [account({ enabled: true, status: 'extension_missing' })] })
      ])
    ).toBe(true)
    expect(
      hasSiteSessionNeedingAttention([
        site({ accounts: [account({ enabled: true, status: 'extension_outdated' })] })
      ])
    ).toBe(true)
    expect(
      hasSiteSessionNeedingAttention([
        site({ accounts: [account({ enabled: true, status: 'permission_missing' })] })
      ])
    ).toBe(true)
    expect(
      hasSiteSessionNeedingAttention([
        site({ accounts: [account({ enabled: true, status: 'import_failed' })] })
      ])
    ).toBe(true)
  })

  it('stays quiet about the accounts whose import is off', () => {
    expect(
      hasSiteSessionNeedingAttention([
        site({
          accounts: [
            account({ enabled: false, status: 'permission_missing' }),
            secondAccount({ enabled: false, status: 'no_cookies_in_browser' })
          ]
        })
      ])
    ).toBe(false)
  })

  it('stays quiet about an account that works', () => {
    expect(
      hasSiteSessionNeedingAttention([
        site({
          accounts: [
            account({ enabled: true, status: 'imported' }),
            secondAccount({ enabled: true, status: 'extension_connected' })
          ]
        })
      ])
    ).toBe(false)
  })
})

import type { ElectronApi } from '@shared-core/types/ipcContract'
import type {
  SiteSessionActionResult,
  SiteSessionListResult,
  SiteSessionSiteView,
  SiteSessionStatusCode
} from '@shared-core/types/siteSession'
import { PRIMARY_ACCOUNT_ID } from '@shared-core/types/siteSession'

import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useElectronMutation, useElectronQuery } from '../useElectron'

export const SITE_SESSION_LIST_KEY = ['site-sessions'] as const

/**
 * The states an account cannot get past on its own.
 *
 * Every one of them asks the user for something: an installed extension, a
 * reloaded extension, a granted permission, a sign-in in Chrome, or a look at
 * why the import failed.
 */
const ATTENTION_STATUSES: ReadonlySet<SiteSessionStatusCode> = new Set([
  'extension_missing',
  'extension_outdated',
  'permission_missing',
  'no_cookies_in_browser',
  'import_failed'
])

/** Whether any account of any site pulls its session from Chrome. */
export function hasEnabledSiteSession(sites: SiteSessionSiteView[]): boolean {
  return sites.some((site) => site.accounts.some((account) => account.enabled))
}

/** Whether an enabled account of a site is waiting for the user. */
export function hasSiteSessionNeedingAttention(sites: SiteSessionSiteView[]): boolean {
  return sites.some((site) =>
    site.accounts.some((account) => account.enabled && ATTENTION_STATUSES.has(account.status))
  )
}

/**
 * The sites and their accounts.
 *
 * The main process sends the fresh list after every account action that was
 * carried out; the subscription turns that event into a refetch, so the row
 * never waits for a poll.
 */
export function useSiteSessionListQuery() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!hasElectronApi()) return
    const api = getElectronApi()
    if (!api?.siteSession) return

    return api.siteSession.onChanged(() => {
      void queryClient.invalidateQueries({ queryKey: SITE_SESSION_LIST_KEY })
    })
  }, [queryClient])

  return useElectronQuery<SiteSessionListResult>({
    key: SITE_SESSION_LIST_KEY,
    queryFn: (api) => api.siteSession.list(),
    options: {
      staleTime: 0,
      retry: false
    }
  })
}

/**
 * One account action that refreshes the list once it has run.
 *
 * Every action may have written part of its change before it failed — the
 * switch before the wipe, the wipe before the delete — so the list is read
 * again whatever the outcome was.
 */
function useSiteSessionMutation<TVariables>(
  mutationFn: (api: ElectronApi, variables: TVariables) => Promise<SiteSessionActionResult>
) {
  const queryClient = useQueryClient()

  return useElectronMutation<SiteSessionActionResult, TVariables>(mutationFn, {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SITE_SESSION_LIST_KEY })
    }
  })
}

/**
 * Turns the import of one account on or off.
 *
 * `accountId` is optional for the old settings card: without it the action
 * targets the primary account, which is the account that card shows.
 */
export function useSetSiteSessionEnabledMutation() {
  return useSiteSessionMutation<{ siteId: string; accountId?: string; enabled: boolean }>(
    (api, { siteId, accountId, enabled }) =>
      api.siteSession.setAccountEnabled(siteId, accountId ?? PRIMARY_ACCOUNT_ID, enabled)
  )
}

/** Forgets the session one account holds, without touching its switch. */
export function useClearSiteSessionMutation() {
  return useSiteSessionMutation<{ siteId: string; accountId?: string }>(
    (api, { siteId, accountId }) =>
      api.siteSession.clearAccount(siteId, accountId ?? PRIMARY_ACCOUNT_ID)
  )
}

/** Marks the account the panels of a site open with. */
export function useSetSiteSessionActiveAccountMutation() {
  return useSiteSessionMutation<{ siteId: string; accountId: string }>((api, variables) =>
    api.siteSession.setActiveAccount(variables.siteId, variables.accountId)
  )
}

/** Gives one account the user's name for it. */
export function useRenameSiteSessionAccountMutation() {
  return useSiteSessionMutation<{ siteId: string; accountId: string; name: string }>(
    (api, { siteId, accountId, name }) => api.siteSession.renameAccount(siteId, accountId, name)
  )
}

/** Removes one additional account and everything it holds. */
export function useDeleteSiteSessionAccountMutation() {
  return useSiteSessionMutation<{ siteId: string; accountId: string }>((api, variables) =>
    api.siteSession.deleteAccount(variables.siteId, variables.accountId)
  )
}

/** Writes a pending session into an existing account, or into a new one for `null`. */
export function useResolveSiteSessionPendingMutation() {
  return useSiteSessionMutation<{ siteId: string; accountId: string | null }>(
    (api, { siteId, accountId }) => api.siteSession.resolvePending(siteId, accountId)
  )
}

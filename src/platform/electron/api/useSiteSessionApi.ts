import type {
  SiteSessionActionResult,
  SiteSessionListResult,
  SiteSessionStatusCode,
  SiteSessionView
} from '@shared-core/types/siteSession'

import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useElectronMutation, useElectronQuery } from '../useElectron'

export const SITE_SESSION_LIST_KEY = ['site-sessions'] as const

/**
 * The states a site cannot get past on its own.
 *
 * Every one of them asks the user for something: an installed extension, a
 * reloaded extension, a granted permission, a sign-in in Chrome, or a look
 * at why the import failed.
 */
const ATTENTION_STATUSES: ReadonlySet<SiteSessionStatusCode> = new Set([
  'extension_missing',
  'extension_outdated',
  'permission_missing',
  'no_cookies_in_browser',
  'import_failed'
])

/** Whether any site pulls its session from Chrome. */
export function hasEnabledSiteSession(views: SiteSessionView[]): boolean {
  return views.some((view) => view.enabled)
}

/** Whether a site whose import is on is waiting for the user. */
export function hasSiteSessionNeedingAttention(views: SiteSessionView[]): boolean {
  return views.some((view) => view.enabled && ATTENTION_STATUSES.has(view.status))
}

/**
 * The sites and their states.
 *
 * The main process sends the fresh list after every switch that was turned
 * and every session that was cleared; the subscription turns that event into
 * a refetch, so the row never waits for a poll.
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

/** Turns the import of one site on or off. */
export function useSetSiteSessionEnabledMutation() {
  const queryClient = useQueryClient()

  return useElectronMutation<SiteSessionActionResult, { siteId: string; enabled: boolean }>(
    (api, { siteId, enabled }) => api.siteSession.setEnabled(siteId, enabled),
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: SITE_SESSION_LIST_KEY })
      }
    }
  )
}

/** Forgets the session the app holds for one site. */
export function useClearSiteSessionMutation() {
  const queryClient = useQueryClient()

  return useElectronMutation<SiteSessionActionResult, { siteId: string }>(
    (api, { siteId }) => api.siteSession.clear(siteId),
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: SITE_SESSION_LIST_KEY })
      }
    }
  )
}

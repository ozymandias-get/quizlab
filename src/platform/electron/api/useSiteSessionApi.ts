import type { SiteSessionListResult } from '@shared-core/types/siteSession'

import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useElectronMutation, useElectronQuery } from '../useElectron'

export const SITE_SESSION_LIST_KEY = ['site-sessions'] as const

/** The outcome of an action on one site's session. */
export interface SiteSessionActionResult {
  success: boolean
  /** A stable code the settings page can translate. */
  error?: string
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

import { reportSuppressedError } from '@shared/lib/logger'

import { useEffect, useRef, useState } from 'react'

interface UseApiChatSessionInitOptions {
  tabId: string
  activeSessionId?: string
  sessions: { id: string; updatedAt: number }[]
  createSessionMutation: () => Promise<{ session: { id: string } }>
  setActiveSessionId: (tabId: string, sessionId: string) => void
  /**
   * Gates the init effect until the sessions query has actually resolved.
   * While the query is loading the caller sees `[]`, which is NOT the same
   * as "the user has no sessions" — creating a session then would race the
   * query and orphan/persist over existing history.
   */
  enabled?: boolean
}

/**
 * Ensures the tab always has an active chat session: creates one when none
 * exists (with a bounded retry) or restores the most recently updated one.
 */
export function useApiChatSessionInit({
  tabId,
  activeSessionId,
  sessions,
  createSessionMutation,
  setActiveSessionId,
  enabled = true
}: UseApiChatSessionInitOptions): void {
  /** The id of the one in-flight create request, or null. */
  const sessionInitInFlightRef = useRef<number | null>(null)
  const sessionInitRequestIdRef = useRef(0)
  const sessionInitRetryCountRef = useRef(0)
  const mountedRef = useRef(true)
  const currentTabIdRef = useRef(tabId)
  currentTabIdRef.current = tabId
  const [retryEpoch, setRetryEpoch] = useState(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // A different tab is a different session target: retries start over and the
  // new tab may start its own request even while the old one is still pending.
  useEffect(() => {
    sessionInitRetryCountRef.current = 0
    sessionInitInFlightRef.current = null
  }, [tabId])

  useEffect(() => {
    if (!enabled) return
    if (activeSessionId) return
    if (sessionInitInFlightRef.current) return
    if (sessions.length === 0) {
      if (sessionInitRetryCountRef.current >= 3) {
        // Do not stay stuck forever after three failures: cool down, then let
        // the effect try again with a fresh budget.
        const timer = setTimeout(() => {
          sessionInitRetryCountRef.current = 0
          setRetryEpoch((value) => value + 1)
        }, 30_000)
        return () => clearTimeout(timer)
      }
      const requestId = ++sessionInitRequestIdRef.current
      sessionInitInFlightRef.current = requestId
      createSessionMutation()
        .then((session) => {
          // Ignore an older request's result even if it finishes after a newer
          // request for the same tab started.
          if (sessionInitInFlightRef.current !== requestId) return
          // The tab may have been closed or switched while the create was in
          // flight; a result for the previous tab must not activate a session
          // in the current one.
          if (!mountedRef.current || currentTabIdRef.current !== tabId) return
          sessionInitRetryCountRef.current = 0
          setActiveSessionId(tabId, session.session.id)
        })
        .catch((err) => {
          // A failed create leaves the tab without a session; retry on the
          // next mutation state change, capped to avoid an error loop.
          sessionInitRetryCountRef.current += 1
          reportSuppressedError('apiChat.sessionInit', { cause: err })
        })
        .finally(() => {
          // Never clear a newer tab's request: only the owner of this id may
          // release the slot.
          if (sessionInitInFlightRef.current === requestId) {
            sessionInitInFlightRef.current = null
          }
        })
      return
    }
    const mostRecent = sessions.reduce((best, s) => (s.updatedAt > best.updatedAt ? s : best))
    setActiveSessionId(tabId, mostRecent.id)
  }, [
    tabId,
    activeSessionId,
    sessions,
    createSessionMutation,
    setActiveSessionId,
    enabled,
    retryEpoch
  ])
}

import { reportSuppressedError } from '@shared/lib/logger'

import { useEffect, useRef } from 'react'

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
  const sessionInitInFlightRef = useRef(false)
  const sessionInitRetryCountRef = useRef(0)

  useEffect(() => {
    if (!enabled) return
    if (activeSessionId) return
    if (sessionInitInFlightRef.current) return
    if (sessions.length === 0) {
      if (sessionInitRetryCountRef.current >= 3) return
      sessionInitInFlightRef.current = true
      createSessionMutation()
        .then((session) => {
          setActiveSessionId(tabId, session.session.id)
        })
        .catch((err) => {
          // A failed create leaves the tab without a session; retry on the
          // next mutation state change, capped to avoid an error loop.
          sessionInitRetryCountRef.current += 1
          reportSuppressedError('apiChat.sessionInit', { cause: err })
        })
        .finally(() => {
          sessionInitInFlightRef.current = false
        })
      return
    }
    const mostRecent = sessions.reduce((best, s) => (s.updatedAt > best.updatedAt ? s : best))
    setActiveSessionId(tabId, mostRecent.id)
  }, [tabId, activeSessionId, sessions, createSessionMutation, setActiveSessionId, enabled])
}

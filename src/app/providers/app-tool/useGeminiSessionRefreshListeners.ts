import {
  GEMINI_WEB_REQUIRES_LOGIN_ERROR,
  GEMINI_WEB_STATUS_KEY,
  useGeminiWebOpenLogin
} from '@platform/electron/api/useGeminiWebSessionApi'

import { getElectronApi } from '@shared/lib/electronApi'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

interface UseGeminiSessionRefreshListenersProps {
  showError: (errorKey: string) => void
  showWarning: (errorKey: string, title?: string) => string
  t: (key: string) => string
}

/**
 * Maximum amount of time the renderer will keep the login overlay visible
 * after `startGeminiWebLogin` is invoked. The backend has its own longer
 * `LOGIN_TIMEOUT_MS`, but we don't want to strand the user with a full-screen
 * modal if the IPC completion event is lost (backend crash, renderer race,
 * etc.). When this fires we hide the overlay locally and surface a warning —
 * the backend flow continues in the background.
 */
const LOGIN_OVERLAY_RENDERER_TIMEOUT_MS = 10 * 60 * 1000

export function useGeminiSessionRefreshListeners({
  showError,
  showWarning,
  t
}: UseGeminiSessionRefreshListenersProps) {
  const queryClient = useQueryClient()
  const [isGeminiWebSessionRefreshing, setIsGeminiWebSessionRefreshing] = useState(false)
  const { mutateAsync: startGeminiWebLoginRaw, isPending: isLoginPending } = useGeminiWebOpenLogin()

  // Local state wraps the underlying mutation so we can clear it on the
  // renderer side (safety timeout, manual dismiss) without depending on the
  // mutation lifecycle alone.
  const [isLoginOverlayVisible, setIsLoginOverlayVisible] = useState(false)
  // Tracks whether the user has explicitly dismissed the login overlay in
  // the current "lifecycle" (i.e., since the most recent login attempt).
  // Suppresses both the refreshing overlay and re-opening the login overlay
  // automatically — but resets the moment a NEW login starts or the current
  // login actually finishes (success/failure), so future refreshes are
  // visible again.
  const [wasLoginDismissed, setWasLoginDismissed] = useState(false)
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSafetyTimeout = useCallback(() => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current)
      safetyTimeoutRef.current = null
    }
  }, [])

  const armSafetyTimeout = useCallback(() => {
    clearSafetyTimeout()
    safetyTimeoutRef.current = setTimeout(() => {
      safetyTimeoutRef.current = null
      // Hide the overlay locally and warn the user. The underlying
      // IPC call continues; React Query will still flip `isPending` to
      // false when the backend eventually responds, at which point
      // isLoginOverlayVisible is already false (no flicker).
      setIsLoginOverlayVisible(false)
      setWasLoginDismissed(true)
      showWarning('gws_overlay_timeout_body', t('gws_overlay_timeout_title'))
    }, LOGIN_OVERLAY_RENDERER_TIMEOUT_MS)
  }, [clearSafetyTimeout, showWarning, t])

  const startGeminiWebLogin = useCallback(async () => {
    // Reset dismissal at the start of every new attempt. The previous
    // attempt (if any) is now considered "abandoned" — any future overlay
    // behavior is decided by this fresh attempt.
    setWasLoginDismissed(false)
    setIsLoginOverlayVisible(true)
    armSafetyTimeout()
    try {
      return await startGeminiWebLoginRaw()
    } finally {
      clearSafetyTimeout()
      setIsLoginOverlayVisible(false)
      // Reset dismissal when the underlying login actually completes
      // (success or failure). This is the right place because the user
      // explicitly took the action; a future silent refresh should be
      // allowed to show its informational overlay again.
      setWasLoginDismissed(false)
    }
  }, [armSafetyTimeout, clearSafetyTimeout, startGeminiWebLoginRaw])

  /**
   * Dismiss the local overlay without aborting the underlying login flow.
   * The backend call will continue in the background; the user gets a
   * warning so they know the modal isn't tracking the flow anymore.
   */
  const dismissLoginOverlay = useCallback(() => {
    if (!isLoginOverlayVisible) return
    setIsLoginOverlayVisible(false)
    setWasLoginDismissed(true)
    clearSafetyTimeout()
    showWarning('gws_overlay_dismissed_body', t('gws_overlay_dismissed_title'))
  }, [clearSafetyTimeout, isLoginOverlayVisible, showWarning, t])

  useEffect(() => {
    const api = getElectronApi()
    if (!api) return
    const unsubscribe = api.geminiWeb.onRefreshEvent((event) => {
      if (event.phase === 'started') {
        setIsGeminiWebSessionRefreshing(true)
      } else {
        setIsGeminiWebSessionRefreshing(false)
      }

      void queryClient.invalidateQueries({ queryKey: GEMINI_WEB_STATUS_KEY })
      if (event.phase === 'failed' && event.error === GEMINI_WEB_REQUIRES_LOGIN_ERROR) {
        showError(event.error)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [queryClient, showError])

  // Clear pending safety timer on unmount.
  useEffect(() => {
    return () => {
      clearSafetyTimeout()
    }
  }, [clearSafetyTimeout])

  return {
    isGeminiWebSessionRefreshing,
    isGeminiWebLoginInProgress: isLoginOverlayVisible || isLoginPending,
    isGeminiWebLoginDismissed: wasLoginDismissed,
    startGeminiWebLogin,
    dismissLoginOverlay
  }
}

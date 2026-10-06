import {
  GEMINI_WEB_REQUIRES_LOGIN_ERROR,
  GEMINI_WEB_STATUS_KEY
} from '@platform/electron/api/useGeminiWebSessionApi'

import { getElectronApi } from '@shared/lib/electronApi'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

interface UseGeminiSessionRefreshListenersProps {
  showError: (errorKey: string) => void
}

/**
 * Re-renders nothing on its own: it only refreshes the Gemini web session
 * status query and surfaces the login-redirect failure. It used to also expose
 * an `isGeminiWebSessionRefreshing` flag, but no consumer read it, so every
 * refresh event re-rendered the whole app tool tree for nothing.
 */
export function useGeminiSessionRefreshListeners({
  showError
}: UseGeminiSessionRefreshListenersProps) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const api = getElectronApi()
    if (!api) return
    const unsubscribe = api.geminiWeb.onRefreshEvent((event) => {
      void queryClient.invalidateQueries({ queryKey: GEMINI_WEB_STATUS_KEY })
      if (event.phase === 'failed' && event.error === GEMINI_WEB_REQUIRES_LOGIN_ERROR) {
        showError(event.error)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [queryClient, showError])
}

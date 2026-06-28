import {
  GEMINI_WEB_REQUIRES_LOGIN_ERROR,
  GEMINI_WEB_STATUS_KEY
} from '@platform/electron/api/useGeminiWebSessionApi'

import { getElectronApi } from '@shared/lib/electronApi'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

interface UseGeminiSessionRefreshListenersProps {
  showError: (errorKey: string) => void
}

export function useGeminiSessionRefreshListeners({
  showError
}: UseGeminiSessionRefreshListenersProps) {
  const queryClient = useQueryClient()
  const [isGeminiWebSessionRefreshing, setIsGeminiWebSessionRefreshing] = useState(false)

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

  return {
    isGeminiWebSessionRefreshing
  }
}

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getElectronApi } from '@shared/lib/electronApi'
import {
  GEMINI_WEB_STATUS_KEY,
  useGeminiWebOpenLogin
} from '@platform/electron/api/useGeminiWebSessionApi'

interface UseGeminiSessionRefreshListenersProps {
  showError: (errorKey: string) => void
}

export function useGeminiSessionRefreshListeners({
  showError
}: UseGeminiSessionRefreshListenersProps) {
  const queryClient = useQueryClient()
  const [isGeminiWebSessionRefreshing, setIsGeminiWebSessionRefreshing] = useState(false)
  const { mutateAsync: startGeminiWebLogin, isPending: isGeminiWebLoginInProgress } =
    useGeminiWebOpenLogin()

  useEffect(() => {
    const unsubscribe = getElectronApi().geminiWeb.onRefreshEvent((event) => {
      if (event.phase === 'started') {
        setIsGeminiWebSessionRefreshing(true)
      } else {
        setIsGeminiWebSessionRefreshing(false)
      }

      void queryClient.invalidateQueries({ queryKey: GEMINI_WEB_STATUS_KEY })
      if (event.phase === 'failed' && event.error === 'error_refresh_failed_requires_login') {
        showError(event.error)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [queryClient, showError])

  return {
    isGeminiWebSessionRefreshing,
    isGeminiWebLoginInProgress,
    startGeminiWebLogin
  }
}

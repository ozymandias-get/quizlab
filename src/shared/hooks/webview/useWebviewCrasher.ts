import { useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import type { WebviewElement } from '@shared-core/types/webview'

const MAX_CRASH_RETRIES = 3
const CRASH_RETRY_DELAY = 1000

interface UseWebviewCrasherProps {
  activeWebviewRef: RefObject<WebviewElement | null>
  currentAI: string
  showWarning: (key: string) => void
  onCrashMaxReached: () => void
  onReloadRequested: () => void
}

/**
 * Hook to manage webview crash recovery and retry logic.
 */
export function useWebviewCrasher({
  activeWebviewRef,
  currentAI,
  showWarning,
  onCrashMaxReached,
  onReloadRequested
}: UseWebviewCrasherProps) {
  const crashRetryCount = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const clearCrashRetryTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const resetCrashCounter = useCallback(() => {
    clearCrashRetryTimeout()
    crashRetryCount.current = 0
  }, [clearCrashRetryTimeout])

  const handleCrashed = useCallback(() => {
    const crashedWebview = activeWebviewRef.current
    const crashedAiId = currentAI

    if (crashRetryCount.current < MAX_CRASH_RETRIES) {
      crashRetryCount.current++
      showWarning('webview_crashed_retrying')
      clearCrashRetryTimeout()

      timeoutRef.current = setTimeout(() => {
        // Only reload if BOTH webview and AI ID haven't changed
        if (activeWebviewRef.current === crashedWebview && currentAI === crashedAiId) {
          onReloadRequested()
        }
      }, CRASH_RETRY_DELAY)
    } else {
      onCrashMaxReached()
    }
  }, [
    activeWebviewRef,
    currentAI,
    showWarning,
    clearCrashRetryTimeout,
    onReloadRequested,
    onCrashMaxReached
  ])

  return {
    handleCrashed,
    clearCrashRetryTimeout,
    resetCrashCounter
  }
}

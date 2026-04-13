import { useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import type { WebviewElement } from '@shared-core/types/webview'

const MAX_CRASH_RETRIES = 3
const CRASH_RETRY_DELAY = 1000
const NON_CRASH_REASONS = new Set(['clean-exit', 'killed'])

interface UseWebviewCrasherProps {
  activeWebviewRef: RefObject<WebviewElement | null>
  currentAI: string
  showWarning: (key: string) => void
  onCrashMaxReached: () => void
  onRecoveryRequested: () => void
}

type RenderProcessGoneEvent = Event & {
  reason?: string
}

/**
 * Hook to manage webview crash recovery and retry logic.
 */
export function useWebviewCrasher({
  activeWebviewRef,
  currentAI,
  showWarning,
  onCrashMaxReached,
  onRecoveryRequested
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

  const handleCrashed = useCallback(
    (event?: Event) => {
      const reason = (event as RenderProcessGoneEvent | undefined)?.reason
      if (reason && NON_CRASH_REASONS.has(reason)) return

      const crashedWebview = activeWebviewRef.current
      const crashedAiId = currentAI

      if (crashRetryCount.current < MAX_CRASH_RETRIES) {
        crashRetryCount.current++
        showWarning('webview_crashed_retrying')
        clearCrashRetryTimeout()

        timeoutRef.current = setTimeout(() => {
          // Only recover if BOTH webview and AI ID haven't changed.
          if (activeWebviewRef.current === crashedWebview && currentAI === crashedAiId) {
            onRecoveryRequested()
          }
        }, CRASH_RETRY_DELAY)
      } else {
        onCrashMaxReached()
      }
    },
    [
      activeWebviewRef,
      currentAI,
      showWarning,
      clearCrashRetryTimeout,
      onRecoveryRequested,
      onCrashMaxReached
    ]
  )

  return {
    handleCrashed,
    clearCrashRetryTimeout,
    resetCrashCounter
  }
}

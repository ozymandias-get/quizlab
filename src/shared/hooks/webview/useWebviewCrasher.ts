import type { WebviewElement } from '@shared-core/types/webview'

import type { RefObject } from 'react'
import { useCallback, useRef } from 'react'

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

  // Use a ref for currentAI so handleCrashed stays stable. Without this,
  // every tab/model switch recreates handleCrashed, which propagates to
  // useWebviewEvents and re-registers all 7 webview event listeners
  // unnecessarily (webviewElement already changes on tab switch, triggering
  // its own re-registration).
  const currentAIRef = useRef(currentAI)
  currentAIRef.current = currentAI

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
      const crashedAiId = currentAIRef.current

      if (crashRetryCount.current < MAX_CRASH_RETRIES) {
        crashRetryCount.current++
        showWarning('webview_crashed_retrying')
        clearCrashRetryTimeout()

        timeoutRef.current = setTimeout(() => {
          // Only recover if BOTH webview and AI ID haven't changed.
          if (activeWebviewRef.current === crashedWebview && currentAIRef.current === crashedAiId) {
            onRecoveryRequested()
          }
        }, CRASH_RETRY_DELAY)
      } else {
        onCrashMaxReached()
      }
    },
    [activeWebviewRef, showWarning, clearCrashRetryTimeout, onRecoveryRequested, onCrashMaxReached]
  )

  return {
    handleCrashed,
    clearCrashRetryTimeout,
    resetCrashCounter
  }
}

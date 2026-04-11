import { useCallback, useRef, useEffect } from 'react'
import { Logger } from '@shared/lib/logger'
import type { WebviewController } from '@shared-core/types/webview'

const POLL_INTERVAL = 500
const PICKER_STATUS_SCRIPT = `
  (function() {
    if (window._aiPickerResult) {
      return { type: 'result', data: window._aiPickerResult };
    }
    if (window._aiPickerCancelled) {
      delete window._aiPickerCancelled;
      return { type: 'cancelled' };
    }
    return null;
  })()
`

type PickerPollStatus = { type: 'cancelled' } | { type: 'result'; data: unknown } | null

interface UsePickerPollingProps {
  webviewInstance: WebviewController | null
  onResult: (data: unknown) => void
  onCancelled: () => void
  onError: (error: unknown) => void
  isMounted: boolean
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function parsePickerPollStatus(value: unknown): PickerPollStatus {
  const parsed = parseJsonValue(value)
  if (!parsed || typeof parsed !== 'object') return null

  const candidate = parsed as { type?: unknown; data?: unknown }
  if (candidate.type === 'cancelled') {
    return { type: 'cancelled' }
  }
  if (candidate.type === 'result') {
    return { type: 'result', data: parseJsonValue(candidate.data) }
  }

  return null
}

/**
 * Specialized hook to manage the polling logic for the Element Picker.
 */
export function usePickerPolling({
  webviewInstance,
  onResult,
  onCancelled,
  onError,
  isMounted
}: UsePickerPollingProps) {
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollInFlightRef = useRef(false)
  const pollSessionRef = useRef(0)

  const stopPolling = useCallback(() => {
    pollSessionRef.current += 1
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
    pollInFlightRef.current = false
  }, [])

  const startPolling = useCallback(() => {
    stopPolling()
    const sessionId = pollSessionRef.current

    const scheduleNextPoll = () => {
      if (!isMounted || pollSessionRef.current !== sessionId) return
      pollTimeoutRef.current = setTimeout(() => {
        pollTimeoutRef.current = null
        void pollOnce()
      }, POLL_INTERVAL)
    }

    const pollOnce = async () => {
      if (pollSessionRef.current !== sessionId || pollInFlightRef.current) return

      const webview = webviewInstance
      if (!webview || typeof webview.executeJavaScript !== 'function') {
        scheduleNextPoll()
        return
      }

      pollInFlightRef.current = true
      try {
        const rawStatus = await webview.executeJavaScript(PICKER_STATUS_SCRIPT)
        if (pollSessionRef.current !== sessionId) return

        const status = parsePickerPollStatus(rawStatus)
        if (!status) {
          scheduleNextPoll()
          return
        }

        if (status.type === 'cancelled') {
          stopPolling()
          if (isMounted) onCancelled()
          return
        }

        if (status.type === 'result') {
          stopPolling()
          if (isMounted) onResult(status.data)
          return
        }

        scheduleNextPoll()
      } catch (error) {
        Logger.warn('[PickerPolling] Polling failed:', error)
        if (isMounted) onError(error)
        scheduleNextPoll()
      } finally {
        if (pollSessionRef.current === sessionId) {
          pollInFlightRef.current = false
        }
      }
    }

    scheduleNextPoll()
  }, [webviewInstance, isMounted, onResult, onCancelled, onError, stopPolling])

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  return {
    startPolling,
    stopPolling
  }
}

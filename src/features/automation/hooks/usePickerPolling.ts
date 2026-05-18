import { useCallback, useRef, useEffect } from 'react'
import { Logger } from '@shared/lib/logger'
import type { WebviewController, WebviewElement } from '@shared-core/types/webview'

interface UsePickerPollingProps {
  getWebviewInstance: () => WebviewController | null | undefined
  onResult: (data: unknown) => void
  onCancelled: () => void
  onError: (error: unknown) => void
  isMounted: boolean
}

/**
 * Event-driven communication for the Element Picker.
 * Replaces polling with listeners for the webview's 'console-message' events.
 */
export function usePickerPolling({
  getWebviewInstance,
  onResult,
  onCancelled,
  isMounted
}: UsePickerPollingProps) {
  const activeWebviewElementRef = useRef<WebviewElement | null>(null)
  const isListeningRef = useRef(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const stopPolling = useCallback(() => {
    isListeningRef.current = false

    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    const el = activeWebviewElementRef.current
    if (el) {
      try {
        el.removeEventListener('console-message', handleConsoleMessage)
      } catch (err) {
        Logger.warn('[PickerListening] Error removing console listener:', err)
      }
      activeWebviewElementRef.current = null
    }
  }, [])

  const handleConsoleMessage = useCallback(
    (e: Event) => {
      if (!isListeningRef.current) return

      const consoleEvent = e as unknown as { message: string }
      const msg = consoleEvent.message
      if (!msg || !msg.startsWith('_aiPicker:')) return

      if (msg === '_aiPicker:cancelled') {
        stopPolling()
        if (isMounted) onCancelled()
      } else if (msg.startsWith('_aiPicker:result:')) {
        const dataStr = msg.slice('_aiPicker:result:'.length)
        try {
          const data = JSON.parse(dataStr)
          stopPolling()
          if (isMounted) onResult(data)
        } catch (err) {
          Logger.warn('[PickerListening] Failed to parse result:', err)
        }
      }
    },
    [isMounted, onCancelled, onResult, stopPolling]
  )

  const startPolling = useCallback(() => {
    stopPolling()

    const controller = getWebviewInstance()
    if (!controller) return

    isListeningRef.current = true

    const attachToElement = (el: WebviewElement | null) => {
      if (activeWebviewElementRef.current === el) return

      // Clean up previous element if any
      if (activeWebviewElementRef.current) {
        try {
          activeWebviewElementRef.current.removeEventListener(
            'console-message',
            handleConsoleMessage
          )
        } catch (err) {
          // ignore
        }
      }

      activeWebviewElementRef.current = el

      if (el && isListeningRef.current) {
        try {
          el.addEventListener('console-message', handleConsoleMessage)
        } catch (err) {
          Logger.warn('[PickerListening] Error adding console listener:', err)
        }
      }
    }

    // Subscribe to element updates to handle dynamic mounting/unmounting
    if (controller.subscribeWebviewElement) {
      unsubscribeRef.current = controller.subscribeWebviewElement((el) => {
        attachToElement(el)
      })
    } else {
      const el = controller.getWebview?.() ?? null
      attachToElement(el)
    }
  }, [getWebviewInstance, handleConsoleMessage, stopPolling])

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

import type { WebviewController, WebviewElement } from '@shared-core/types/webview'

import { Logger } from '@shared/lib/logger'

import { type MutableRefObject, useCallback, useEffect, useRef } from 'react'

interface ConsoleMessageEvent {
  message: string
}

function isConsoleMessageEvent(e: unknown): e is ConsoleMessageEvent {
  return (
    typeof e === 'object' &&
    e !== null &&
    'message' in e &&
    typeof (e as ConsoleMessageEvent).message === 'string'
  )
}

interface UsePickerConsoleBridgeProps {
  getWebviewInstance: () => WebviewController | null | undefined
  onResult: (result: unknown) => void
  onCancelled: () => void
  onError: (error: unknown) => void
  mountedRef: MutableRefObject<boolean>
}

/**
 * Bridges console messages emitted by the injected picker script back to
 * renderer callbacks. The picker script (run in the webview) writes results
 * to its own globals and mirrors them to the host via `console-message` lines
 * prefixed with `_aiPicker:`. We subscribe to that event once and route each
 * message to the right consumer callback. This is **event-driven** — there is
 * no polling loop.
 */
export function usePickerConsoleBridge({
  getWebviewInstance,
  onResult,
  onCancelled,
  onError,
  mountedRef
}: UsePickerConsoleBridgeProps) {
  const activeWebviewElementRef = useRef<WebviewElement | null>(null)
  const isListeningRef = useRef(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const onResultRef = useRef(onResult)
  const onCancelledRef = useRef(onCancelled)
  const onErrorRef = useRef(onError)
  // Intentionally no dependency array: this effect mirrors the latest
  // callback identities into refs so the event-driven console handler
  // (registered once on startListening) can call the most recent consumer
  // callbacks without re-binding on every render. Adding a dep array here
  // would either force a re-bind (defeating the purpose) or risk stale
  // closures if a new prop slips past.
  useEffect(() => {
    onResultRef.current = onResult
    onCancelledRef.current = onCancelled
    onErrorRef.current = onError
  })

  const stableConsoleHandlerRef = useRef<(e: Event) => void>(() => {})

  const stableConsoleHandler = useCallback((e: Event) => {
    stableConsoleHandlerRef.current(e)
  }, [])

  const stopListening = useCallback(() => {
    isListeningRef.current = false

    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    const el = activeWebviewElementRef.current
    if (el) {
      try {
        el.removeEventListener('console-message', stableConsoleHandler)
      } catch (err) {
        Logger.warn('[PickerConsoleBridge] Error removing console listener:', err)
      }
      activeWebviewElementRef.current = null
    }
  }, [stableConsoleHandler])

  useEffect(() => {
    stableConsoleHandlerRef.current = (e: Event) => {
      if (!isListeningRef.current) return

      if (!isConsoleMessageEvent(e)) return
      const msg = e.message
      if (!msg || !msg.startsWith('_aiPicker:')) return

      if (!mountedRef.current) {
        stopListening()
        return
      }

      if (msg === '_aiPicker:cancelled') {
        stopListening()
        onCancelledRef.current()
      } else if (msg.startsWith('_aiPicker:result:')) {
        const dataStr = msg.slice('_aiPicker:result:'.length)
        try {
          const data = JSON.parse(dataStr)
          stopListening()
          onResultRef.current(data)
        } catch (err) {
          Logger.warn('[PickerConsoleBridge] Failed to parse result:', err)
          onErrorRef.current(err)
        }
      }
    }
  }, [mountedRef, stopListening])

  const startListening = useCallback(() => {
    stopListening()

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
            stableConsoleHandler
          )
        } catch {
          // ignore
        }
      }

      activeWebviewElementRef.current = el

      if (el && isListeningRef.current) {
        try {
          el.addEventListener('console-message', stableConsoleHandler)
        } catch (err) {
          Logger.warn('[PickerConsoleBridge] Error adding console listener:', err)
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
  }, [getWebviewInstance, stableConsoleHandler, stopListening])

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  return {
    startListening,
    stopListening
  }
}

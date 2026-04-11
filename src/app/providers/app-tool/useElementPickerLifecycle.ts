import { useCallback, useEffect, useRef, useState } from 'react'
import { useElementPicker } from '@features/automation'
import { Logger } from '@shared/lib/logger'
import type { WebviewLike } from '@shared-core/types/webview'
import { ensureErrorMessage } from '@shared/lib/errorUtils'

import { oncePickerReady, waitForWebviewElement } from './webviewPickerReadiness'

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/**
 * Hook to manage the automatic arming and injection of the element picker into a webview.
 * Handles waiting for the webview content to be ready before starting the picker.
 */
export function useElementPickerLifecycle(webviewInstance: WebviewLike) {
  const { isPickerActive, startPicker, togglePicker } = useElementPicker(webviewInstance)

  const [armVersion, setArmVersion] = useState(0)
  const pendingPickerStartRef = useRef(false)
  const requestSeqRef = useRef(0)

  const clearPendingRequest = useCallback((requestId: number) => {
    if (requestSeqRef.current === requestId) {
      pendingPickerStartRef.current = false
    }
  }, [])

  const isCurrentPendingRequest = useCallback((requestId: number) => {
    return requestSeqRef.current === requestId && pendingPickerStartRef.current
  }, [])

  const startPickerWhenReady = useCallback(() => {
    if (!webviewInstance) {
      pendingPickerStartRef.current = false
      return
    }
    requestSeqRef.current += 1
    pendingPickerStartRef.current = true
    setArmVersion((v) => v + 1)
  }, [webviewInstance])

  useEffect(() => {
    if (!pendingPickerStartRef.current || !webviewInstance) {
      return
    }

    const requestId = requestSeqRef.current
    const controller = webviewInstance
    const abortController = new AbortController()
    const { signal } = abortController

    const runLifecycle = async () => {
      try {
        // 1. Wait for webview element to exist in DOM
        const el = await waitForWebviewElement(controller, signal)

        if (signal.aborted || !isCurrentPendingRequest(requestId)) {
          Logger.info('[ElementPickerLifecycle] stale request cancelled during element wait', {
            requestId
          })
          return
        }

        if (typeof el.isDestroyed === 'function' && el.isDestroyed()) {
          Logger.info('[ElementPickerLifecycle] webview disposed, request cancelled', { requestId })
          clearPendingRequest(requestId)
          return
        }

        Logger.info('[ElementPickerLifecycle] awaiting readiness for picker injection', {
          requestId
        })

        // 2. Wait for content readiness (dom-ready, did-stop-loading, or catchup)
        const reason = await oncePickerReady(controller, signal)

        if (signal.aborted || !isCurrentPendingRequest(requestId)) {
          Logger.info('[ElementPickerLifecycle] stale request ignored during readiness', {
            requestId,
            reason
          })
          return
        }

        const currentEl = controller.getWebview?.()
        if (currentEl !== el || (typeof el.isDestroyed === 'function' && el.isDestroyed())) {
          Logger.info('[ElementPickerLifecycle] stale webview instance, ignoring readiness', {
            requestId,
            reason
          })
          clearPendingRequest(requestId)
          return
        }

        Logger.info('[ElementPickerLifecycle] webview ready, injecting picker', {
          requestId,
          reason
        })

        clearPendingRequest(requestId)

        // 3. Perform final injection
        try {
          await startPicker()
          Logger.info('[ElementPickerLifecycle] picker started successfully', { requestId })
        } catch (error) {
          Logger.warn('[ElementPickerLifecycle] picker start failed:', error)
        }
      } catch (error) {
        if (isAbortError(error)) {
          return
        }
        const message = ensureErrorMessage(error)
        Logger.warn('[ElementPickerLifecycle] lifecycle failed:', message)
        clearPendingRequest(requestId)
      }
    }

    void runLifecycle()

    return () => {
      abortController.abort()
    }
  }, [armVersion, clearPendingRequest, isCurrentPendingRequest, startPicker, webviewInstance])

  return {
    isPickerActive,
    startPicker,
    startPickerWhenReady,
    togglePicker
  }
}

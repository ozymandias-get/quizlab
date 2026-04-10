import { useCallback, useEffect, useRef, useState } from 'react'
import { useElementPicker } from '@features/automation'
import { Logger } from '@shared/lib/logger'
import type { WebviewLike } from '@shared-core/types/webview'

import { subscribeWebviewPickerReadiness } from './webviewPickerReadiness'

const MAX_ELEMENT_BIND_RETRIES = 12

export function useElementPickerLifecycle(webviewInstance: WebviewLike) {
  const { isPickerActive, startPicker, togglePicker } = useElementPicker(webviewInstance)

  const [armVersion, setArmVersion] = useState(0)
  const [bindRetryTick, setBindRetryTick] = useState(0)
  const pendingPickerStartRef = useRef(false)
  const requestSeqRef = useRef(0)
  const elementBindRetriesRef = useRef(0)
  /** Reset element bind retries when the active controller instance changes (e.g. tab switch). */
  const lastWebviewForBindRef = useRef<WebviewLike>(null)

  const startPickerWhenReady = useCallback(() => {
    if (!webviewInstance) {
      pendingPickerStartRef.current = false
      return
    }
    requestSeqRef.current += 1
    elementBindRetriesRef.current = 0
    pendingPickerStartRef.current = true
    setArmVersion((v) => v + 1)
  }, [webviewInstance])

  useEffect(() => {
    if (!pendingPickerStartRef.current || !webviewInstance) {
      return
    }

    if (lastWebviewForBindRef.current !== webviewInstance) {
      lastWebviewForBindRef.current = webviewInstance
      elementBindRetriesRef.current = 0
    }

    const requestId = requestSeqRef.current
    const controller = webviewInstance
    const abortController = new AbortController()

    let disposeSubscription: (() => void) | null = null
    let bindRetryTimeout: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (bindRetryTimeout !== null) {
        clearTimeout(bindRetryTimeout)
        bindRetryTimeout = null
      }
      abortController.abort()
      disposeSubscription?.()
      disposeSubscription = null
    }

    const arm = () => {
      const el = controller.getWebview?.()
      if (!el) {
        if (elementBindRetriesRef.current >= MAX_ELEMENT_BIND_RETRIES) {
          Logger.warn('[ElementPickerLifecycle] webview element still not bound, giving up', {
            requestId
          })
          pendingPickerStartRef.current = false
          return
        }
        elementBindRetriesRef.current += 1
        Logger.info('[ElementPickerLifecycle] webview element not bound, waiting', { requestId })
        bindRetryTimeout = setTimeout(() => {
          bindRetryTimeout = null
          setBindRetryTick((t) => t + 1)
        }, 0)
        return
      }

      elementBindRetriesRef.current = 0

      if (typeof el.isDestroyed === 'function' && el.isDestroyed()) {
        Logger.info('[ElementPickerLifecycle] webview disposed, pending request cancelled', {
          requestId
        })
        pendingPickerStartRef.current = false
        return
      }

      Logger.info('[ElementPickerLifecycle] picker requested, awaiting readiness', { requestId })

      disposeSubscription = subscribeWebviewPickerReadiness(controller, {
        signal: abortController.signal,
        onReady: (reason) => {
          if (abortController.signal.aborted) {
            return
          }
          if (requestSeqRef.current !== requestId || !pendingPickerStartRef.current) {
            Logger.info('[ElementPickerLifecycle] stale readiness ignored', {
              requestId,
              current: requestSeqRef.current,
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
            pendingPickerStartRef.current = false
            return
          }

          Logger.info('[ElementPickerLifecycle] readiness received from event', {
            requestId,
            reason
          })

          pendingPickerStartRef.current = false

          void (async () => {
            try {
              await startPicker()
              Logger.info('[ElementPickerLifecycle] picker start accepted', { requestId })
            } catch (error) {
              Logger.warn('[ElementPickerLifecycle] picker injection failed', error)
            }
          })()
        }
      })
    }

    arm()

    return () => {
      cleanup()
    }
  }, [armVersion, bindRetryTick, startPicker, webviewInstance])

  return {
    isPickerActive,
    startPicker,
    startPickerWhenReady,
    togglePicker
  }
}

import type { AiContentController } from '@shared-core/types/aiContent'
import type { AiViewEventOf } from '@shared-core/types/aiView'

import { Logger } from '@shared/lib/logger'

import { type RefObject, useCallback, useEffect, useRef } from 'react'

/** Messages the injected picker script writes to the guest console. */
const PICKER_PREFIX = '_aiPicker:'
const PICKER_RESULT_PREFIX = '_aiPicker:result:'
const PICKER_CANCELLED = '_aiPicker:cancelled'

export interface UsePickerConsoleBridgeOptions {
  getContentController: () => AiContentController | null | undefined
  mountedRef: RefObject<boolean>
  onResult: (data: unknown) => void | Promise<void>
  onCancelled: () => void
  onError: (error: unknown) => void
}

export interface UsePickerConsoleBridgeResult {
  startListening: (controller?: AiContentController | null) => void
  stopListening: () => void
}

/**
 * Bridges console messages emitted by the injected picker script back to
 * renderer callbacks.
 *
 * The picker script (running inside the managed view) mirrors its result to the
 * guest console with an `_aiPicker:` prefix. Those console messages now travel
 * `WebContents.console-message → main process → typed IPC → this bridge`, and we
 * subscribe straight to the controller's console channel. This stays fully
 * event-driven: no polling, no `executeJavaScript` probe.
 */
export function usePickerConsoleBridge({
  getContentController,
  mountedRef,
  onResult,
  onCancelled,
  onError
}: UsePickerConsoleBridgeOptions): UsePickerConsoleBridgeResult {
  const targetControllerRef = useRef<AiContentController | null>(null)
  const getControllerRef = useRef(getContentController)
  const isListeningRef = useRef(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const handleConsoleRef = useRef<(event: AiViewEventOf<'console-message'>) => void>(() => {})

  const onResultRef = useRef(onResult)
  const onCancelledRef = useRef(onCancelled)
  const onErrorRef = useRef(onError)

  // Intentionally no dependency array: this effect mirrors the latest callback
  // identities into refs so the event-driven handler registered once by
  // startListening can call the most recent consumer callbacks without
  // re-binding on every render.
  useEffect(() => {
    getControllerRef.current = getContentController
    onResultRef.current = onResult
    onCancelledRef.current = onCancelled
    onErrorRef.current = onError
  })

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    targetControllerRef.current = null
  }, [])

  useEffect(() => {
    handleConsoleRef.current = (event: AiViewEventOf<'console-message'>) => {
      if (!isListeningRef.current) return
      const message = event?.message
      if (!message || !message.startsWith(PICKER_PREFIX)) return

      if (!mountedRef.current) {
        stopListening()
        return
      }

      // A tab switch mid-selection must not deliver a stale result.
      if (getControllerRef.current() !== targetControllerRef.current) {
        stopListening()
        return
      }

      if (message === PICKER_CANCELLED) {
        stopListening()
        onCancelledRef.current()
        return
      }

      if (!message.startsWith(PICKER_RESULT_PREFIX)) return

      const payload = message.slice(PICKER_RESULT_PREFIX.length)
      try {
        const data = JSON.parse(payload)
        stopListening()
        onResultRef.current(data)
      } catch (error) {
        Logger.warn('[PickerConsoleBridge] Failed to parse result:', error)
        onErrorRef.current(error)
      }
    }
  }, [mountedRef, stopListening])

  const startListening = useCallback(
    (target?: AiContentController | null) => {
      stopListening()
      const controller = target ?? getControllerRef.current()
      if (!controller?.subscribeEvent) return
      targetControllerRef.current = controller
      isListeningRef.current = true
      unsubscribeRef.current = controller.subscribeEvent('console-message', (event) =>
        handleConsoleRef.current(event)
      )
    },
    [stopListening]
  )

  useEffect(() => {
    return () => stopListening()
  }, [stopListening])

  return { startListening, stopListening }
}

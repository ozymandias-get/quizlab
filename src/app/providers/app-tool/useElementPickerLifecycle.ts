import type { WebviewController, WebviewElement, WebviewLike } from '@shared-core/types/webview'

import { useElementPicker } from '@features/automation'

import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { PickerReadinessReason } from './webviewPickerReadiness'

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/**
 * Hook to manage the automatic arming and injection of the element picker into a webview.
 * webviewPickerReadiness is dynamically imported on first use to keep it out of the main chunk.
 */
export function useElementPickerLifecycle(
  getWebviewInstance: () => WebviewLike | null | undefined
) {
  const { showError } = useToastActions()

  const pickerHook = useElementPicker(getWebviewInstance)

  const [armVersion, setArmVersion] = useState(0)
  const pendingPickerStartRef = useRef(false)
  const requestSeqRef = useRef(0)
  const pickerModRef = useRef<{
    oncePickerReady: (
      controller: WebviewController,
      signal: AbortSignal
    ) => Promise<PickerReadinessReason>
    waitForWebviewElement: (
      controller: WebviewController,
      signal: AbortSignal
    ) => Promise<WebviewElement>
  } | null>(null)
  const lifecycleAbortRef = useRef<AbortController | null>(null)

  const loadReadinessModule = useCallback(async () => {
    if (pickerModRef.current) return pickerModRef.current
    const readinessMod = await import('./webviewPickerReadiness')
    pickerModRef.current = {
      oncePickerReady: readinessMod.oncePickerReady,
      waitForWebviewElement: readinessMod.waitForWebviewElement
    }
    return pickerModRef.current
  }, [])

  const clearPendingRequest = useCallback((requestId: number) => {
    if (requestSeqRef.current === requestId) {
      pendingPickerStartRef.current = false
    }
  }, [])

  const isCurrentPendingRequest = useCallback((requestId: number) => {
    return requestSeqRef.current === requestId && pendingPickerStartRef.current
  }, [])

  const startPickerWhenReady = useCallback(async () => {
    if (!getWebviewInstance()) {
      Logger.info('[PickerLifecycle] startPickerWhenReady: no webview instance')
      pendingPickerStartRef.current = false
      return
    }
    requestSeqRef.current += 1
    pendingPickerStartRef.current = true
    setArmVersion((v) => v + 1)
    Logger.info(`[PickerLifecycle] startPickerWhenReady: armed, requestId=${requestSeqRef.current}`)
  }, [getWebviewInstance])

  useEffect(() => {
    if (!pendingPickerStartRef.current) return

    const currentInstance = getWebviewInstance()
    if (!currentInstance) {
      return
    }

    let cancelled = false

    const controller = new AbortController()
    lifecycleAbortRef.current = controller

    const runLifecycle = async () => {
      try {
        const mod = pickerModRef.current
        if (!mod) {
          const loadedMod = await loadReadinessModule()
          if (cancelled) return
          await runPickerLifecycle(loadedMod, controller.signal)
        } else {
          await runPickerLifecycle(mod, controller.signal)
        }
      } catch (error) {
        if (isAbortError(error) || cancelled) {
          return
        }
        const message = ensureErrorMessage(error)
        Logger.warn('[ElementPickerLifecycle] lifecycle failed:', message)
        clearPendingRequest(requestSeqRef.current)
      }
    }

    const runPickerLifecycle = async (
      mod: NonNullable<typeof pickerModRef.current>,
      signal: AbortSignal
    ) => {
      const controller = currentInstance!
      const requestId = requestSeqRef.current
      const el = await mod.waitForWebviewElement(controller, signal)

      if (cancelled || !isCurrentPendingRequest(requestId)) {
        return
      }

      if (
        typeof (el as { isDestroyed?: () => boolean }).isDestroyed === 'function' &&
        (el as { isDestroyed: () => boolean }).isDestroyed()
      ) {
        clearPendingRequest(requestId)
        return
      }

      const reason = await mod.oncePickerReady(controller, signal)

      if (cancelled || !isCurrentPendingRequest(requestId)) {
        Logger.info('[ElementPickerLifecycle] stale request ignored during readiness', {
          requestId,
          reason
        })
        return
      }

      clearPendingRequest(requestId)

      try {
        await pickerHook.startPicker()
        Logger.info('[ElementPickerLifecycle] picker started successfully', { requestId })
      } catch (error) {
        Logger.warn('[ElementPickerLifecycle] picker start failed:', error)
        showError('picker_init_failed')
      }
    }

    void runLifecycle()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    armVersion,
    clearPendingRequest,
    isCurrentPendingRequest,
    getWebviewInstance,
    loadReadinessModule,
    showError,
    pickerHook.startPicker
  ])

  return {
    isPickerActive: pickerHook.isPickerActive,
    startPicker: pickerHook.startPicker,
    startPickerWhenReady,
    togglePicker: pickerHook.togglePicker
  }
}

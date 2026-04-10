import type { WebviewLike } from '@shared-core/types/webview'

export type PickerReadinessReason = 'dom-ready' | 'did-stop-loading' | 'catchup-ready-state'

export interface SubscribeWebviewPickerReadinessOptions {
  /** When aborted, readiness callbacks must not fire. */
  signal?: AbortSignal
  onReady: (reason: PickerReadinessReason) => void
}

/**
 * Subscribes to <webview> lifecycle for picker script injection readiness.
 * Uses dom-ready + did-stop-loading; one-shot document.readyState if events were missed.
 */
export function subscribeWebviewPickerReadiness(
  controller: WebviewLike,
  options: SubscribeWebviewPickerReadinessOptions
): () => void {
  const { signal, onReady } = options

  if (!controller) {
    return () => {}
  }

  const el = controller.getWebview?.() ?? null
  if (!el) {
    return () => {}
  }

  let disposed = false
  let fulfilled = false

  const tryFulfill = (reason: PickerReadinessReason) => {
    if (disposed || fulfilled || signal?.aborted) {
      return
    }
    fulfilled = true
    disposed = true
    cleanupListeners()
    if (signal) {
      signal.removeEventListener('abort', onAbort)
    }
    onReady(reason)
  }

  const onDomReady = () => {
    tryFulfill('dom-ready')
  }

  const onStopLoading = () => {
    tryFulfill('did-stop-loading')
  }

  function onAbort() {
    if (disposed) {
      return
    }
    disposed = true
    cleanupListeners()
  }

  function cleanupListeners() {
    el?.removeEventListener('dom-ready', onDomReady)
    el?.removeEventListener('did-stop-loading', onStopLoading)
  }

  el.addEventListener('dom-ready', onDomReady)
  el.addEventListener('did-stop-loading', onStopLoading)

  let catchupScheduled = false
  const runCatchup = async () => {
    if (disposed || fulfilled || signal?.aborted) {
      return
    }
    if (typeof controller.executeJavaScript !== 'function') {
      return
    }
    try {
      const readyState = await controller.executeJavaScript('document.readyState')
      if (disposed || fulfilled || signal?.aborted) {
        return
      }
      if (readyState === 'interactive' || readyState === 'complete') {
        tryFulfill('catchup-ready-state')
      }
    } catch {
      // Ignore; lifecycle events remain subscribed.
    }
  }

  const scheduleCatchup = () => {
    if (disposed || fulfilled || catchupScheduled || signal?.aborted) {
      return
    }
    catchupScheduled = true
    queueMicrotask(() => {
      void runCatchup()
    })
  }

  scheduleCatchup()

  if (signal) {
    if (signal.aborted) {
      onAbort()
      return () => {}
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }

  return () => {
    if (disposed) {
      return
    }
    disposed = true
    cleanupListeners()
    if (signal) {
      signal.removeEventListener('abort', onAbort)
    }
  }
}

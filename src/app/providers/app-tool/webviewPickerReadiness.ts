import type { WebviewController, WebviewElement, WebviewLike } from '@shared-core/types/webview'

export type PickerReadinessReason = 'dom-ready' | 'did-stop-loading' | 'catchup-ready-state'

function abortError(): Error {
  return new DOMException('Aborted', 'AbortError')
}

/**
 * Resolves when `getWebview()` is non-null, using `subscribeWebviewElement` if needed.
 */
export function waitForWebviewElement(
  controller: WebviewController,
  signal: AbortSignal
): Promise<WebviewElement> {
  const immediate = controller.getWebview?.() ?? null
  if (immediate) {
    return Promise.resolve(immediate)
  }

  const subscribe = controller.subscribeWebviewElement
  if (!subscribe) {
    return Promise.reject(
      new Error('WebviewController.subscribeWebviewElement is required when getWebview() is empty')
    )
  }

  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }

    let unsubscribe: (() => void) | null = null

    const handleAbort = () => {
      unsubscribe?.()
      unsubscribe = null
      reject(abortError())
    }

    signal.addEventListener('abort', handleAbort, { once: true })

    unsubscribe = subscribe((el) => {
      if (signal.aborted || !el) {
        return
      }
      unsubscribe?.()
      unsubscribe = null
      signal.removeEventListener('abort', handleAbort)
      resolve(el)
    })
  })
}

/**
 * One-shot picker injection readiness (dom-ready, did-stop-loading, or readyState catch-up).
 */
export function oncePickerReady(
  controller: WebviewController,
  signal: AbortSignal
): Promise<PickerReadinessReason> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }

    let dispose: (() => void) | null = null

    const handleAbort = () => {
      dispose?.()
      dispose = null
      reject(abortError())
    }

    signal.addEventListener('abort', handleAbort, { once: true })

    dispose = subscribeWebviewPickerReadiness(controller, {
      signal,
      onReady: (reason) => {
        signal.removeEventListener('abort', handleAbort)
        resolve(reason)
      }
    })
  })
}

interface SubscribeWebviewPickerReadinessOptions {
  /** When aborted, readiness callbacks must not fire. */
  signal?: AbortSignal
  onReady: (reason: PickerReadinessReason) => void
}

/**
 * Subscribes to <webview> lifecycle for picker script injection readiness.
 * Uses dom-ready + did-stop-loading; one-shot document.readyState if events were missed.
 */
function subscribeWebviewPickerReadiness(
  controller: WebviewLike,
  options: SubscribeWebviewPickerReadinessOptions
): () => void {
  const { signal, onReady } = options

  if (!controller) return () => {}

  const el = controller.getWebview?.() ?? null
  if (!el) return () => {}

  let disposed = false
  let fulfilled = false

  const tryFulfill = (reason: PickerReadinessReason) => {
    if (disposed || fulfilled || signal?.aborted) return

    fulfilled = true
    disposed = true
    cleanupListeners()
    if (signal) signal.removeEventListener('abort', handleAbort)
    onReady(reason)
  }

  const handleDomReady = () => tryFulfill('dom-ready')
  const handleStopLoading = () => tryFulfill('did-stop-loading')

  const handleAbort = () => {
    if (disposed) return
    disposed = true
    cleanupListeners()
  }

  const cleanupListeners = () => {
    el?.removeEventListener('dom-ready', handleDomReady)
    el?.removeEventListener('did-stop-loading', handleStopLoading)
  }

  el.addEventListener('dom-ready', handleDomReady)
  el.addEventListener('did-stop-loading', handleStopLoading)

  // ReadyState Catch-up logic (to handle cases where listeners were added after events fired)
  const runCatchup = async () => {
    if (
      disposed ||
      fulfilled ||
      signal?.aborted ||
      typeof controller.executeJavaScript !== 'function'
    )
      return

    try {
      const readyState = await controller.executeJavaScript('document.readyState')
      if (
        !disposed &&
        !fulfilled &&
        !signal?.aborted &&
        (readyState === 'interactive' || readyState === 'complete')
      ) {
        tryFulfill('catchup-ready-state')
      }
    } catch {
      // Ignore; lifecycle events remain subscribed.
    }
  }

  queueMicrotask(() => void runCatchup())

  if (signal) {
    if (signal.aborted) {
      handleAbort()
      return () => {}
    }
    signal.addEventListener('abort', handleAbort, { once: true })
  }

  return () => {
    if (disposed) return
    disposed = true
    cleanupListeners()
    if (signal) signal.removeEventListener('abort', handleAbort)
  }
}

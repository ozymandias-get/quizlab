import type { AiContentController, AiContentRef } from '@shared-core/types/aiContent'

export type PickerReadinessReason = 'dom-ready' | 'did-stop-loading' | 'catchup-ready-state'

function abortError(): Error {
  return new DOMException('Aborted', 'AbortError')
}

/**
 * Resolves once the managed view exists in the main process.
 *
 * Replaces the old "the `<webview>` element is mounted" check: readiness is now
 * reported by `AiContentController.subscribeReady`, so nothing has to observe a
 * DOM node that no longer exists.
 */
export function waitForContentReady(
  controller: AiContentController,
  signal: AbortSignal
): Promise<void> {
  if (controller.isReady?.() === true) return Promise.resolve()

  const subscribe = controller.subscribeReady
  if (!subscribe) {
    return Promise.reject(new Error('AiContentController.subscribeReady is required'))
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

    unsubscribe = subscribe((ready) => {
      if (!ready) return
      unsubscribe?.()
      unsubscribe = null
      signal.removeEventListener('abort', handleAbort)
      resolve()
    })
  })
}

/**
 * One-shot picker injection readiness (dom-ready, did-stop-loading, or a
 * document.readyState catch-up for events that fired before we subscribed).
 */
export function oncePickerReady(
  controller: AiContentController,
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

    dispose = subscribePickerReadiness(controller, {
      signal,
      onReady: (reason) => {
        signal.removeEventListener('abort', handleAbort)
        resolve(reason)
      }
    })
  })
}

interface SubscribePickerReadinessOptions {
  /** When aborted, readiness callbacks must not fire. */
  signal?: AbortSignal
  onReady: (reason: PickerReadinessReason) => void
}

function subscribePickerReadiness(
  controller: AiContentRef,
  options: SubscribePickerReadinessOptions
): () => void {
  const { signal, onReady } = options

  if (!controller) return () => {}

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
    for (const unsubscribe of unsubscribes) unsubscribe()
    unsubscribes.length = 0
  }

  const unsubscribes: Array<() => void> = []

  if (typeof controller.subscribeEvent === 'function') {
    unsubscribes.push(controller.subscribeEvent('dom-ready', handleDomReady))
    unsubscribes.push(controller.subscribeEvent('did-stop-loading', handleStopLoading))
  }

  // ReadyState catch-up for events that already fired before we subscribed.
  const runCatchup = async () => {
    if (
      disposed ||
      fulfilled ||
      signal?.aborted ||
      typeof controller.executeJavaScript !== 'function'
    ) {
      return
    }

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

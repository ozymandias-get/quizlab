import type { AiContentController } from '@shared-core/types/aiContent'

import { reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Loading / error / crash-recovery state for one managed content view.
 *
 * Mirrors the lifecycle the `<content>` element used to drive, but every
 * handler now receives a typed payload from the main process instead of a DOM
 * event, and the DOM-specific concerns (scrollbar CSS injection, `new-window`)
 * are gone — the first lives in main, the second is enforced by
 * `applyRemoteContentSecurity`.
 */

const MAX_CRASH_RETRIES = 3
const CRASH_RETRY_DELAY = 1000
const NON_CRASH_REASONS = new Set(['clean-exit', 'killed'])

const ERROR_CODE_ABORTED = -3
const ERROR_CODE_FAILED = -2
const ERROR_CODE_CONNECTION_CLOSED = -100
const ERROR_CODE_CONNECTION_RESET = -101
const ERROR_CODE_CONNECTION_REFUSED = -102
const ERROR_CODE_CONNECTION_ABORTED = -103
const ERROR_CODE_CONNECTION_FAILED = -104

const TRANSIENT_ERROR_CODES = new Set([
  ERROR_CODE_ABORTED,
  ERROR_CODE_FAILED,
  ERROR_CODE_CONNECTION_CLOSED,
  ERROR_CODE_CONNECTION_RESET,
  ERROR_CODE_CONNECTION_REFUSED,
  ERROR_CODE_CONNECTION_ABORTED,
  ERROR_CODE_CONNECTION_FAILED
])

const ABORT_PENDING_AUTOMATION_SCRIPT =
  'try{window.__quizlabAbortController&&window.__quizlabAbortController.abort()}catch(e){}'

export interface UseAiContentLifecycleOptions {
  currentAI: string
  /** Controller for this view; `null` until the host has been mounted. */
  controller: AiContentController | null
  registerContent?: (controller: AiContentController | null, expected?: AiContentController) => void
  t: (key: string) => string
  showWarning: (key: string) => void
  onUrlChange?: (url: string) => void
  onPageSettled?: (controller: AiContentController) => void
  onCrashRecoveryRequested?: () => void
}

export interface UseAiContentLifecycleResult {
  isLoading: boolean
  error: string | null
  /**
   * True once the current view completed its first load. The native view stays
   * hidden until then so the splash is not covered, but is never hidden again
   * for in-page navigations.
   */
  hasLoadedOnce: boolean
  handleRetry: () => void
}

/** Mirrors the transient codes the main process forwards but must not surface. */
function isTransientErrorCode(code: number): boolean {
  return TRANSIENT_ERROR_CODES.has(code)
}

function describeError(description: string, t: (key: string) => string): string {
  return description && description.length > 0 ? description : t('page_load_failed')
}

export function useAiContentLifecycle({
  currentAI,
  controller,
  registerContent,
  t,
  showWarning,
  onUrlChange,
  onPageSettled,
  onCrashRecoveryRequested
}: UseAiContentLifecycleOptions): UseAiContentLifecycleResult {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const hasInitiallyLoadedRef = useRef(false)
  const crashRetryCountRef = useRef(0)
  const crashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onUrlChangeRef = useRef(onUrlChange)
  const onPageSettledRef = useRef(onPageSettled)
  const onCrashRecoveryRequestedRef = useRef(onCrashRecoveryRequested)
  const currentAIRef = useRef(currentAI)
  const controllerRef = useRef<AiContentController | null>(controller)
  controllerRef.current = controller
  currentAIRef.current = currentAI

  useEffect(() => {
    onUrlChangeRef.current = onUrlChange
    onPageSettledRef.current = onPageSettled
    onCrashRecoveryRequestedRef.current = onCrashRecoveryRequested
  })

  const clearCrashTimer = useCallback(() => {
    if (crashTimerRef.current === null) return
    clearTimeout(crashTimerRef.current)
    crashTimerRef.current = null
  }, [])

  const reportUrl = useCallback((url: string | undefined) => {
    if (!url) return
    onUrlChangeRef.current?.(url)
  }, [])

  /**
   * Marks the first load attempt as settled.
   *
   * `hasLoadedOnce` gates the native view's reveal, so it has to mean "stop
   * waiting", not "the load succeeded" — otherwise a view whose entry load failed
   * fatally stays behind its splash with nothing on screen.
   */
  const settleFirstLoad = useCallback((content: AiContentController, notify: boolean) => {
    setIsLoading(false)
    if (hasInitiallyLoadedRef.current) return
    hasInitiallyLoadedRef.current = true
    setHasLoadedOnce(true)
    if (notify) onPageSettledRef.current?.(content)
  }, [])

  const abortPendingAutomation = useCallback(() => {
    const content = controllerRef.current
    if (!content) return
    try {
      void Promise.resolve(content.executeJavaScript(ABORT_PENDING_AUTOMATION_SCRIPT)).catch(() => {
        // Navigation may already have replaced the document.
      })
    } catch (error) {
      reportSuppressedError('aiContent.abortAutomation', { cause: error })
    }
  }, [])

  useEffect(() => {
    if (!controller) return

    const unsubscribes = [
      /**
       * The manager's authoritative snapshot.
       *
       * This is how a host that mounted onto an *existing* `WebContentsView`
       * learns where the guest stands. A focus-mode handoff, or a tab returning
       * from behind AI Home, mounts a fresh controller for a view that finished
       * loading long ago; it will never see another `did-stop-loading`, so
       * without this it would hold the native view behind the splash forever.
       * The same event also carries the last load failure, so a view that died
       * fatally before the handoff shows its error instead of spinning.
       */
      controller.subscribeEvent?.('state', (event) => {
        // A response from a preload that predates the snapshot contract carries
        // no load state; assume the conservative answer rather than reporting an
        // idle guest that has not painted.
        const loading = typeof event.isLoading === 'boolean' ? event.isLoading : true
        // Once the view has settled the splash must not come back for a later
        // navigation — same rule as `did-start-loading`.
        if (!(loading && hasInitiallyLoadedRef.current)) setIsLoading(loading)
        reportUrl(event.currentUrl)

        // The recorded failure is the *last attempt's*, so it survives until a new
        // attempt or an actual document clears it. It is not, by itself, a reason
        // to stop waiting: an aborted redirect hop reports one mid-navigation.
        const failure = event.error ?? null
        if (failure && !isTransientErrorCode(failure.code)) {
          setError(describeError(failure.description, t))
        } else if (!failure) {
          setError(null)
        }

        if (event.hasLoadedOnce === true) {
          // The attempt settled, so the splash goes down and the native view is
          // revealed. The settled-callback is skipped when the attempt produced
          // no document, because there is nothing to inspect for stale content.
          settleFirstLoad(controller, failure === null)
        }
      }),

      controller.subscribeEvent?.('did-start-loading', () => {
        setError(null)
        if (hasInitiallyLoadedRef.current) return
        setIsLoading(true)
      }),

      controller.subscribeEvent?.('did-stop-loading', () => {
        settleFirstLoad(controller, true)
      }),

      controller.subscribeEvent?.('dom-ready', (event) => {
        reportUrl('currentUrl' in event ? event.currentUrl : undefined)
      }),

      controller.subscribeEvent?.('did-fail-load', (event) => {
        setIsLoading(false)
        if (isTransientErrorCode(event.errorCode)) return
        setError(describeError(event.errorDescription, t))
      }),

      controller.subscribeEvent?.('did-navigate', (event) => {
        abortPendingAutomation()
        reportUrl(event.url)
      }),

      controller.subscribeEvent?.('did-navigate-in-page', (event) => {
        abortPendingAutomation()
        reportUrl(event.url)
      }),

      controller.subscribeEvent?.('render-process-gone', (event) => {
        if (NON_CRASH_REASONS.has(event.reason)) return

        const crashedController = controllerRef.current
        const crashedAiId = currentAIRef.current

        if (crashRetryCountRef.current < MAX_CRASH_RETRIES) {
          crashRetryCountRef.current += 1
          showWarning('webview_crashed_retrying')
          clearCrashTimer()
          crashTimerRef.current = setTimeout(() => {
            crashTimerRef.current = null
            // Only recover if neither the controller nor the model changed.
            if (controllerRef.current !== crashedController) return
            if (currentAIRef.current !== crashedAiId) return
            setIsLoading(true)
            setError(null)
            onCrashRecoveryRequestedRef.current?.()
          }, CRASH_RETRY_DELAY)
          return
        }

        setError(t('webview_crashed_max'))
      })
    ]

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe?.()
    }
  }, [
    abortPendingAutomation,
    clearCrashTimer,
    controller,
    reportUrl,
    settleFirstLoad,
    showWarning,
    t
  ])

  useEffect(() => {
    crashRetryCountRef.current = 0
    clearCrashTimer()
    hasInitiallyLoadedRef.current = false
    setHasLoadedOnce(false)
    setIsLoading(true)
    setError(null)
  }, [clearCrashTimer, currentAI])

  useEffect(() => {
    if (!registerContent || !controller) return
    registerContent(controller)
    return () => registerContent(null, controller)
  }, [controller, registerContent])

  useEffect(() => {
    return () => clearCrashTimer()
  }, [clearCrashTimer])

  const handleRetry = useCallback(() => {
    clearCrashTimer()
    setError(null)
    // A crashed renderer often ignores a plain reload (OOM / GPU kill), so the
    // remount path is preferred whenever the host wired one up.
    if (onCrashRecoveryRequestedRef.current) {
      setIsLoading(true)
      onCrashRecoveryRequestedRef.current()
      return
    }
    controllerRef.current?.reload?.()
  }, [clearCrashTimer])

  return { isLoading, error, hasLoadedOnce, handleRetry }
}

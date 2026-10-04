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
      controller.subscribeEvent?.('did-start-loading', () => {
        setError(null)
        if (hasInitiallyLoadedRef.current) return
        setIsLoading(true)
      }),

      controller.subscribeEvent?.('did-stop-loading', () => {
        setIsLoading(false)
        if (!hasInitiallyLoadedRef.current) {
          hasInitiallyLoadedRef.current = true
          setHasLoadedOnce(true)
        }
        onPageSettledRef.current?.(controller)
      }),

      controller.subscribeEvent?.('dom-ready', (event) => {
        reportUrl('currentUrl' in event ? event.currentUrl : undefined)
      }),

      controller.subscribeEvent?.('did-fail-load', (event) => {
        setIsLoading(false)
        if (TRANSIENT_ERROR_CODES.has(event.errorCode)) return
        setError(
          event.errorDescription && event.errorDescription.length > 0
            ? event.errorDescription
            : t('page_load_failed')
        )
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
  }, [abortPendingAutomation, clearCrashTimer, controller, reportUrl, showWarning, t])

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

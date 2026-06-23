import type { WebviewController, WebviewElement } from '@shared-core/types/webview'

import { reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useWebviewCrasher } from './useWebviewCrasher'
import { useWebviewEventHandlers } from './useWebviewEventHandlers'
import { useWebviewEvents } from './useWebviewEvents'
import { useWebviewMethods } from './useWebviewMethods'

interface UseWebviewLifecycleProps {
  currentAI: string
  registerWebview?: (methods: WebviewController | null) => void
  t: (key: string) => string
  showWarning: (key: string) => void
  onUrlChange?: (url: string) => void
  onPageSettled?: (webview: WebviewElement) => void
  onCrashRecoveryRequested?: () => void
}

/**
 * Webview Lifecycle Hook
 * Orchestrates loading states, errors, and crashes by using specialized sub-hooks.
 */
export function useWebviewLifecycle({
  currentAI,
  registerWebview,
  t,
  showWarning,
  onUrlChange,
  onPageSettled,
  onCrashRecoveryRequested
}: UseWebviewLifecycleProps) {
  const activeWebviewRef = useRef<WebviewElement | null>(null)
  const webviewElementListenersRef = useRef(new Set<(el: WebviewElement | null) => void>())

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [webviewElement, setWebviewElement] = useState<WebviewElement | null>(null)

  // Tracks whether the *current* webview instance has finished its first
  // `did-stop-loading`. Once true, in-page navigations (e.g. submitting a
  // prompt, soft reloads, form posts that the AI web performs on send) must
  // NOT re-show the splash — the user is already in the chat.
  const hasInitiallyLoadedRef = useRef(false)

  // Updated via a deps-less effect that only writes to refs (no state updates,
  // no re-render trigger).
  const onUrlChangeRef = useRef(onUrlChange)
  const onPageSettledRef = useRef(onPageSettled)
  const onCrashRecoveryRequestedRef = useRef(onCrashRecoveryRequested)

  useEffect(() => {
    onUrlChangeRef.current = onUrlChange
    onPageSettledRef.current = onPageSettled
    onCrashRecoveryRequestedRef.current = onCrashRecoveryRequested
  })

  // Reset the "initially loaded" flag whenever the webview element is swapped
  // (tab change, model change, crash recovery remount). A fresh webview should
  // be allowed to show the splash on its first load.
  useEffect(() => {
    hasInitiallyLoadedRef.current = false
  }, [webviewElement])

  const webviewMethods = useWebviewMethods({
    activeWebviewRef,
    webviewElementListenersRef
  })

  const handleCrashMaxReached = useCallback(() => {
    setError(t('webview_crashed_max'))
  }, [t])

  const handleRecoveryRequested = useCallback(() => {
    setIsLoading(true)
    setError(null)
    if (onCrashRecoveryRequestedRef.current) {
      onCrashRecoveryRequestedRef.current()
      return
    }
    activeWebviewRef.current?.reload()
  }, [])

  const { handleCrashed, clearCrashRetryTimeout, resetCrashCounter } = useWebviewCrasher({
    activeWebviewRef,
    currentAI,
    showWarning,
    onCrashMaxReached: handleCrashMaxReached,
    onRecoveryRequested: handleRecoveryRequested
  })

  // Global cleanup & identity reset
  useEffect(() => {
    resetCrashCounter()
    setIsLoading(true)
    setError(null)
  }, [resetCrashCounter, currentAI])

  useEffect(() => {
    return () => {
      clearCrashRetryTimeout()
      for (const listener of webviewElementListenersRef.current) {
        try {
          listener(null)
        } catch (error) {
          reportSuppressedError('webview.cleanup.subscriber', { cause: error })
        }
      }
      activeWebviewRef.current = null
      if (registerWebview) registerWebview(null)
    }
  }, [clearCrashRetryTimeout, registerWebview])

  useEffect(() => {
    if (registerWebview) {
      registerWebview(webviewElement ? webviewMethods : null)
    }
    return () => {
      if (registerWebview) registerWebview(null)
    }
  }, [registerWebview, webviewElement, webviewMethods])

  const {
    handleStartLoading,
    handleStopLoading,
    handleFailLoad,
    handleNewWindow,
    handleDomReady,
    handleDidNavigateInPage,
    handleDidNavigate
  } = useWebviewEventHandlers({
    activeWebviewRef,
    hasInitiallyLoadedRef,
    onUrlChangeRef,
    onPageSettledRef,
    setIsLoading,
    setError,
    showWarning,
    t
  })

  useWebviewEvents({
    webviewElement,
    onStartLoading: handleStartLoading,
    onStopLoading: handleStopLoading,
    onFailLoad: handleFailLoad,
    onNewWindow: handleNewWindow,
    onDomReady: handleDomReady,
    onCrashed: handleCrashed,
    onDidNavigate: handleDidNavigate,
    onDidNavigateInPage: handleDidNavigateInPage
  })

  const onWebviewRef = useCallback(
    (element: WebviewElement | null) => {
      if (activeWebviewRef.current === element) return
      clearCrashRetryTimeout()
      activeWebviewRef.current = element
      setWebviewElement(element)
      for (const listener of webviewElementListenersRef.current) {
        try {
          listener(element)
        } catch (error) {
          reportSuppressedError('webview.refChange.subscriber', { cause: error })
        }
      }

      if (!element) {
        resetCrashCounter()
        setError(null)
        setIsLoading(true)
      }
    },
    [clearCrashRetryTimeout, resetCrashCounter]
  )

  const handleRetry = useCallback(() => {
    clearCrashRetryTimeout()
    setError(null)
    activeWebviewRef.current?.reload()
  }, [clearCrashRetryTimeout])

  return {
    isLoading,
    error,
    activeWebviewRef,
    onWebviewRef,
    handleRetry
  }
}

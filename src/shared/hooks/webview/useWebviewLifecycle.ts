import { useRef, useState, useCallback, useEffect } from 'react'
import { getElectronApi } from '@shared/lib/electronApi'
import { Logger, reportSuppressedError } from '@shared/lib/logger'
import type { WebviewController, WebviewElement } from '@shared-core/types/webview'
import { useWebviewMethods } from './useWebviewMethods'
import { useWebviewCrasher } from './useWebviewCrasher'
import { useWebviewEvents } from './useWebviewEvents'

const ERROR_CODE_ABORTED = -3
const WEBVIEW_SCROLLBAR_CSS = `
  html, body {
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.28) rgba(255,255,255,0.08);
  }

  *::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  *::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.08);
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  *::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.18));
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  *::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(255,255,255,0.46), rgba(255,255,255,0.24));
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  *::-webkit-scrollbar-corner {
    background: transparent;
  }
`

interface UseWebviewLifecycleProps {
  currentAI: string
  registerWebview?: (methods: WebviewController | null) => void
  t: (key: string) => string
  showWarning: (key: string) => void
  onUrlChange?: (url: string) => void
  onPageSettled?: (webview: WebviewElement) => void
  onCrashRecoveryRequested?: () => void
}

type FailLoadEvent = {
  errorCode?: number
  errorDescription?: string
}

type NewWindowEvent = {
  url?: string
  preventDefault: () => void
}

function extractEventUrl(event: Event): string | undefined {
  const url = (event as Event & { url?: unknown }).url
  return typeof url === 'string' && url.length > 0 ? url : undefined
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

  // Use refs for callbacks that change frequently to stabilize event handlers
  const onUrlChangeRef = useRef(onUrlChange)
  const onPageSettledRef = useRef(onPageSettled)

  useEffect(() => {
    onUrlChangeRef.current = onUrlChange
    onPageSettledRef.current = onPageSettled
  })

  const webviewMethods = useWebviewMethods({
    activeWebviewRef,
    webviewElementListenersRef
  })

  const { handleCrashed, clearCrashRetryTimeout, resetCrashCounter } = useWebviewCrasher({
    activeWebviewRef,
    currentAI,
    showWarning,
    onCrashMaxReached: () => setError(t('webview_crashed_max')),
    onRecoveryRequested: () => {
      setIsLoading(true)
      setError(null)
      if (onCrashRecoveryRequested) {
        onCrashRecoveryRequested()
        return
      }
      activeWebviewRef.current?.reload()
    }
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
      webviewElementListenersRef.current.forEach((listener) => {
        try {
          listener(null)
        } catch (error) {
          reportSuppressedError('webview.cleanup.subscriber', { cause: error })
        }
      })
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

  // Event Handlers
  const handleStartLoading = useCallback(() => {
    setIsLoading(true)
    setError(null)
  }, [])

  const handleStopLoading = useCallback(() => {
    setIsLoading(false)
    const onPageSettledCb = onPageSettledRef.current
    if (onPageSettledCb) {
      const wv = activeWebviewRef.current
      if (wv) onPageSettledCb(wv)
    }
  }, [])

  const handleFailLoad = useCallback(
    (event: Event) => {
      const failEvent = event as FailLoadEvent
      setIsLoading(false)
      if (failEvent.errorCode === ERROR_CODE_ABORTED) return
      setError(failEvent.errorDescription || t('page_load_failed'))
    },
    [t]
  )

  const handleNewWindow = useCallback(async (event: Event) => {
    event.preventDefault()
    const newWindowEvent = event as NewWindowEvent
    try {
      const url = newWindowEvent.url
      if (!url) return
      const targetUrl = new URL(url)
      const api = getElectronApi()

      // Handle auth domains or same-origin URLs internally
      const isAuth = await api.isAuthDomain(targetUrl.hostname)
      const currentRawUrl = activeWebviewRef.current?.getURL?.()
      const isSameOrigin = currentRawUrl
        ? new URL(currentRawUrl).origin === targetUrl.origin
        : false

      if (isAuth || isSameOrigin) {
        activeWebviewRef.current?.loadURL?.(url)
        return
      }

      await api.openExternal(url)
    } catch (err) {
      Logger.error('[Webview] New window error:', err)
    }
  }, [])

  const handleDomReady = useCallback(() => {
    const wv = activeWebviewRef.current
    wv?.insertCSS?.(WEBVIEW_SCROLLBAR_CSS).catch((err) =>
      reportSuppressedError('webview.insertCSS.scrollbar', { cause: err })
    )
    const onUrlChangeCb = onUrlChangeRef.current
    if (onUrlChangeCb) {
      const url = wv?.getURL?.()
      if (url) onUrlChangeCb(url)
    }
  }, [])

  const handleDidNavigateInPage = useCallback((event: Event) => {
    const url = extractEventUrl(event)
    if (!url) return

    const onUrlChangeCb = onUrlChangeRef.current
    if (onUrlChangeCb) onUrlChangeCb(url)

    const onPageSettledCb = onPageSettledRef.current
    const wv = activeWebviewRef.current
    if (onPageSettledCb && wv) {
      onPageSettledCb(wv)
    }
  }, [])

  const handleDidNavigate = useCallback((event: Event) => {
    const url = extractEventUrl(event)
    const onUrlChangeCb = onUrlChangeRef.current
    if (url && onUrlChangeCb) onUrlChangeCb(url)
  }, [])

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
      webviewElementListenersRef.current.forEach((listener) => {
        try {
          listener(element)
        } catch (error) {
          reportSuppressedError('webview.refChange.subscriber', { cause: error })
        }
      })

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

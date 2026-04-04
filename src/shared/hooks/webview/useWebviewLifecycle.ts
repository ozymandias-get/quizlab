import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { getElectronApi } from '@shared/lib/electronApi'
import type {
  WebviewController,
  WebviewElement,
  WebviewInputEvent
} from '@shared-core/types/webview'

// Crash recovery constants
const MAX_CRASH_RETRIES = 3
const CRASH_RETRY_DELAY = 1000
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
}

type FailLoadEvent = {
  errorCode?: number
  errorDescription?: string
}

type NewWindowEvent = {
  url?: string
  preventDefault: () => void
}

/**
 * Webview Lifecycle Hook
 * Manages loading states, errors, crashes and exposes webview methods.
 */
export function useWebviewLifecycle({
  currentAI,
  registerWebview,
  t,
  showWarning
}: UseWebviewLifecycleProps) {
  const activeWebviewRef = useRef<WebviewElement | null>(null)
  const crashRetryCount = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [webviewElement, setWebviewElement] = useState<WebviewElement | null>(null)

  const withActiveWebview = useCallback(
    <T>(operation: (webview: WebviewElement) => T): T | undefined => {
      const webview = activeWebviewRef.current
      if (!webview) {
        return undefined
      }

      return operation(webview)
    },
    []
  )

  // Reset state on AI change
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsLoading(true)
    setError(null)
    crashRetryCount.current = 0
  }, [currentAI])

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      activeWebviewRef.current = null
      if (registerWebview) registerWebview(null)
    }
  }, [registerWebview])

  const handleRetry = useCallback(() => {
    setError(null)
    activeWebviewRef.current?.reload()
  }, [])

  // Expose webview methods
  const webviewMethods = useMemo<WebviewController>(
    () => ({
      // Reflect.apply keeps the correct `this` for native webview bindings (avoids "Illegal invocation").
      executeJavaScript: (script: string) =>
        withActiveWebview((webview) => {
          const fn = webview.executeJavaScript
          if (typeof fn !== 'function') return undefined
          return Reflect.apply(fn, webview, [script])
        }),
      getWebview: () => activeWebviewRef.current,
      insertText: (text: string) => withActiveWebview((webview) => webview.insertText?.(text)),
      reload: () => withActiveWebview((webview) => webview.reload()),
      goBack: () => withActiveWebview((webview) => webview.goBack?.()),
      goForward: () => withActiveWebview((webview) => webview.goForward?.()),
      getURL: () => withActiveWebview((webview) => webview.getURL?.()),
      sendInputEvent: (event: WebviewInputEvent) =>
        withActiveWebview((webview) => webview.sendInputEvent?.(event)),
      paste: () =>
        withActiveWebview((webview) => {
          const fn = webview.paste
          if (typeof fn !== 'function') return undefined
          return Reflect.apply(fn, webview, [])
        }),
      getWebContentsId: () => withActiveWebview((webview) => webview.getWebContentsId?.()),
      pasteNative: async (id: number) => {
        if (id) {
          return await getElectronApi().forcePaste(id)
        }
        return false
      },
      addEventListener: (
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) => withActiveWebview((webview) => webview.addEventListener(event, handler, options)),
      removeEventListener: (
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions
      ) => withActiveWebview((webview) => webview.removeEventListener(event, handler, options)),
      focus: () => withActiveWebview((webview) => webview.focus?.()),
      isDestroyed: () => withActiveWebview((webview) => webview.isDestroyed?.() ?? false) ?? false
    }),
    [withActiveWebview]
  )

  useEffect(() => {
    if (!registerWebview) return

    registerWebview(webviewElement ? webviewMethods : null)

    return () => {
      registerWebview(null)
    }
  }, [registerWebview, webviewElement, webviewMethods])

  // Event Handlers
  const handleStartLoading = useCallback(() => {
    setIsLoading(true)
    setError(null)
  }, [])

  const handleStopLoading = useCallback(() => {
    setIsLoading(false)
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

  const handleCrashed = useCallback(() => {
    const crashedWebview = activeWebviewRef.current
    const crashedAiId = currentAI // Capture current AI ID
    setIsLoading(false)
    if (crashRetryCount.current < MAX_CRASH_RETRIES) {
      crashRetryCount.current++
      showWarning('webview_crashed_retrying')
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        // Only reload if BOTH webview and AI ID haven't changed
        if (activeWebviewRef.current === crashedWebview && currentAI === crashedAiId) {
          activeWebviewRef.current?.reload()
        }
      }, CRASH_RETRY_DELAY)
    } else {
      setError(t('webview_crashed_max'))
    }
  }, [currentAI, showWarning, t])

  const handleNewWindow = useCallback(async (event: Event) => {
    event.preventDefault()
    const newWindowEvent = event as NewWindowEvent
    try {
      if (!newWindowEvent.url) return
      const targetUrl = new URL(newWindowEvent.url)
      const api = getElectronApi()
      const isAuth = await api.isAuthDomain(targetUrl.hostname)
      if (isAuth) {
        activeWebviewRef.current?.loadURL?.(newWindowEvent.url)
        return
      }
      await api.openExternal(newWindowEvent.url)
    } catch (err) {
      console.error('[Webview] New window error:', err)
    }
  }, [])

  const handleDomReady = useCallback(() => {
    activeWebviewRef.current?.insertCSS?.(WEBVIEW_SCROLLBAR_CSS).catch(() => {})
  }, [])

  const onWebviewRef = useCallback((element: WebviewElement | null) => {
    if (activeWebviewRef.current === element) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    activeWebviewRef.current = element
    setWebviewElement(element)

    if (!element) {
      crashRetryCount.current = 0
      setError(null)
      setIsLoading(true)
    }
  }, [])

  // Event Listeners Binding
  useEffect(() => {
    const wv = webviewElement
    if (!wv) return

    wv.addEventListener('did-start-loading', handleStartLoading)
    wv.addEventListener('did-stop-loading', handleStopLoading)
    wv.addEventListener('did-fail-load', handleFailLoad)
    wv.addEventListener('new-window', handleNewWindow)
    wv.addEventListener('dom-ready', handleDomReady)
    wv.addEventListener('render-process-gone', handleCrashed)

    return () => {
      wv.removeEventListener('did-start-loading', handleStartLoading)
      wv.removeEventListener('did-stop-loading', handleStopLoading)
      wv.removeEventListener('did-fail-load', handleFailLoad)
      wv.removeEventListener('new-window', handleNewWindow)
      wv.removeEventListener('dom-ready', handleDomReady)
      wv.removeEventListener('render-process-gone', handleCrashed)
    }
  }, [
    handleCrashed,
    handleDomReady,
    handleFailLoad,
    handleNewWindow,
    handleStartLoading,
    handleStopLoading,
    webviewElement
  ])

  return {
    isLoading,
    error,
    activeWebviewRef,
    onWebviewRef,
    handleRetry
  }
}

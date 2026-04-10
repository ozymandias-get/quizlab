import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { getElectronApi } from '@shared/lib/electronApi'
import type {
  WebviewController,
  WebviewElement,
  WebviewInputEvent
} from '@shared-core/types/webview'

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
  /** Fires on top-level and in-page navigations (for session URL restore). */
  onUrlChange?: (url: string) => void
  /** Fires after page finishes loading (did-stop-loading). */
  onPageSettled?: (webview: WebviewElement) => void
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
 * Manages loading states, errors, crashes and exposes webview methods.
 */
export function useWebviewLifecycle({
  currentAI,
  registerWebview,
  t,
  showWarning,
  onUrlChange,
  onPageSettled
}: UseWebviewLifecycleProps) {
  const activeWebviewRef = useRef<WebviewElement | null>(null)
  const crashRetryCount = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [webviewElement, setWebviewElement] = useState<WebviewElement | null>(null)

  const clearCrashRetryTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

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

  useEffect(() => {
    clearCrashRetryTimeout()
    setIsLoading(true)
    setError(null)
    crashRetryCount.current = 0
  }, [clearCrashRetryTimeout, currentAI])

  useEffect(() => {
    return () => {
      clearCrashRetryTimeout()
      activeWebviewRef.current = null
      if (registerWebview) registerWebview(null)
    }
  }, [clearCrashRetryTimeout, registerWebview])

  const handleRetry = useCallback(() => {
    clearCrashRetryTimeout()
    setError(null)
    activeWebviewRef.current?.reload()
  }, [clearCrashRetryTimeout])

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

  const handleStartLoading = useCallback(() => {
    setIsLoading(true)
    setError(null)
  }, [])

  const handleStopLoading = useCallback(() => {
    setIsLoading(false)
    if (onPageSettled) {
      const wv = activeWebviewRef.current
      if (wv) onPageSettled(wv)
    }
  }, [onPageSettled])

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
    const crashedAiId = currentAI
    setIsLoading(false)
    if (crashRetryCount.current < MAX_CRASH_RETRIES) {
      crashRetryCount.current++
      showWarning('webview_crashed_retrying')
      clearCrashRetryTimeout()
      timeoutRef.current = setTimeout(() => {
        // Only reload if BOTH webview and AI ID haven't changed
        if (activeWebviewRef.current === crashedWebview && currentAI === crashedAiId) {
          activeWebviewRef.current?.reload()
        }
      }, CRASH_RETRY_DELAY)
    } else {
      setError(t('webview_crashed_max'))
    }
  }, [clearCrashRetryTimeout, currentAI, showWarning, t])

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

      const currentRawUrl = activeWebviewRef.current?.getURL?.()
      if (currentRawUrl) {
        try {
          if (new URL(currentRawUrl).origin === targetUrl.origin) {
            activeWebviewRef.current?.loadURL?.(newWindowEvent.url)
            return
          }
        } catch {}
      }

      await api.openExternal(newWindowEvent.url)
    } catch (err) {
      console.error('[Webview] New window error:', err)
    }
  }, [])

  const handleDidNavigate = useCallback(
    (event: Event) => {
      const url = extractEventUrl(event)
      if (url && onUrlChange) onUrlChange(url)
    },
    [onUrlChange]
  )

  const handleDidNavigateInPage = useCallback(
    (event: Event) => {
      const url = extractEventUrl(event)
      if (!url) return
      if (onUrlChange) onUrlChange(url)
      if (onPageSettled) {
        const wv = activeWebviewRef.current
        if (wv) onPageSettled(wv)
      }
    },
    [onUrlChange, onPageSettled]
  )

  const handleDomReady = useCallback(() => {
    const wv = activeWebviewRef.current
    wv?.insertCSS?.(WEBVIEW_SCROLLBAR_CSS).catch(() => {})
    if (onUrlChange) {
      const url = wv?.getURL?.()
      if (typeof url === 'string' && url.length > 0) {
        onUrlChange(url)
      }
    }
  }, [onUrlChange])

  const onWebviewRef = useCallback(
    (element: WebviewElement | null) => {
      if (activeWebviewRef.current === element) return

      clearCrashRetryTimeout()

      activeWebviewRef.current = element
      setWebviewElement(element)

      if (!element) {
        crashRetryCount.current = 0
        setError(null)
        setIsLoading(true)
      }
    },
    [clearCrashRetryTimeout]
  )

  useEffect(() => {
    const wv = webviewElement
    if (!wv) return

    wv.addEventListener('did-start-loading', handleStartLoading)
    wv.addEventListener('did-stop-loading', handleStopLoading)
    wv.addEventListener('did-fail-load', handleFailLoad)
    wv.addEventListener('new-window', handleNewWindow)
    wv.addEventListener('dom-ready', handleDomReady)
    wv.addEventListener('render-process-gone', handleCrashed)
    if (onUrlChange) {
      wv.addEventListener('did-navigate', handleDidNavigate)
    }
    wv.addEventListener('did-navigate-in-page', handleDidNavigateInPage)

    return () => {
      wv.removeEventListener('did-start-loading', handleStartLoading)
      wv.removeEventListener('did-stop-loading', handleStopLoading)
      wv.removeEventListener('did-fail-load', handleFailLoad)
      wv.removeEventListener('new-window', handleNewWindow)
      wv.removeEventListener('dom-ready', handleDomReady)
      wv.removeEventListener('render-process-gone', handleCrashed)
      if (onUrlChange) {
        wv.removeEventListener('did-navigate', handleDidNavigate)
      }
      wv.removeEventListener('did-navigate-in-page', handleDidNavigateInPage)
    }
  }, [
    handleCrashed,
    handleDidNavigate,
    handleDidNavigateInPage,
    handleDomReady,
    handleFailLoad,
    handleNewWindow,
    handleStartLoading,
    handleStopLoading,
    onUrlChange,
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

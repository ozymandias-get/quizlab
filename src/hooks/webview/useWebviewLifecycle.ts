import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import type { WebviewController, WebviewElement, WebviewInputEvent } from '@shared/types/webview';

// Crash recovery constants
const MAX_CRASH_RETRIES = 3
const CRASH_RETRY_DELAY = 1000
const ERROR_CODE_ABORTED = -3

interface UseWebviewLifecycleProps {
    currentAI: string;
    registerWebview?: (methods: WebviewController | null) => void;
    t: (key: string) => string;
    showWarning: (key: string) => void;
}

type FailLoadEvent = {
    errorCode?: number;
    errorDescription?: string;
}

type NewWindowEvent = {
    url?: string;
    preventDefault: () => void;
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

    // Reset state on AI change
    useEffect(() => {
        setIsLoading(true)
        setError(null)
        crashRetryCount.current = 0
    }, [currentAI])

    // Cleanup
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            if (registerWebview) registerWebview(null)
        }
    }, [registerWebview])

    const handleRetry = useCallback(() => {
        setError(null)
        if (activeWebviewRef.current) {
            activeWebviewRef.current.reload()
        }
    }, [])

    // Expose webview methods
    const webviewMethods = useMemo<WebviewController>(() => ({
        executeJavaScript: (script: string) => activeWebviewRef.current?.executeJavaScript(script),
        getActiveWebview: () => activeWebviewRef.current,
        getWebview: () => activeWebviewRef.current,
        insertText: (text: string) => activeWebviewRef.current?.insertText?.(text),
        reload: () => activeWebviewRef.current?.reload(),
        goBack: () => activeWebviewRef.current?.goBack?.(),
        goForward: () => activeWebviewRef.current?.goForward?.(),
        getURL: () => activeWebviewRef.current?.getURL?.(),
        sendInputEvent: (event: WebviewInputEvent) => activeWebviewRef.current?.sendInputEvent?.(event),
        paste: () => activeWebviewRef.current?.paste?.(),
        getWebContentsId: () => activeWebviewRef.current?.getWebContentsId?.(),
        pasteNative: async (id: number) => {
            if (id && window.electronAPI?.forcePaste) {
                return await window.electronAPI.forcePaste(id);
            }
            return false;
        },
        addEventListener: (event: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) =>
            activeWebviewRef.current?.addEventListener(event, handler, options),
        removeEventListener: (event: string, handler: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) =>
            activeWebviewRef.current?.removeEventListener(event, handler, options),
        focus: () => activeWebviewRef.current?.focus?.(),
        isDestroyed: () => activeWebviewRef.current?.isDestroyed?.() ?? false
    }), [])

    useEffect(() => {
        if (registerWebview && activeWebviewRef.current) {
            registerWebview(webviewMethods)
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

    const handleFailLoad = useCallback((event: Event) => {
        const failEvent = event as FailLoadEvent
        setIsLoading(false)
        if (failEvent.errorCode === ERROR_CODE_ABORTED) return
        setError(failEvent.errorDescription || t('page_load_failed'))
    }, [t])

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
    }, [showWarning, t, currentAI])

    const handleNewWindow = useCallback(async (event: Event) => {
        event.preventDefault()
        const newWindowEvent = event as NewWindowEvent
        try {
            if (!newWindowEvent.url) return
            const targetUrl = new URL(newWindowEvent.url)
            const isAuth = await window.electronAPI?.isAuthDomain?.(targetUrl.hostname)
            if (isAuth) {
                activeWebviewRef.current?.loadURL?.(newWindowEvent.url)
                return
            }
            window.electronAPI?.openExternal?.(newWindowEvent.url)
        } catch (err) {
            console.error('[Webview] New window error:', err)
        }
    }, [])

    const onWebviewRef = useCallback((element: WebviewElement | null) => {
        if (!element || activeWebviewRef.current === element) return
        activeWebviewRef.current = element
        setWebviewElement(element)
    }, [])

    // Event Listeners Binding
    useEffect(() => {
        const wv = webviewElement
        if (!wv) return

        wv.addEventListener('did-start-loading', handleStartLoading)
        wv.addEventListener('did-stop-loading', handleStopLoading)
        wv.addEventListener('did-fail-load', handleFailLoad)
        wv.addEventListener('new-window', handleNewWindow)
        wv.addEventListener('render-process-gone', handleCrashed)

        return () => {
            wv.removeEventListener('did-start-loading', handleStartLoading)
            wv.removeEventListener('did-stop-loading', handleStopLoading)
            wv.removeEventListener('did-fail-load', handleFailLoad)
            wv.removeEventListener('new-window', handleNewWindow)
            wv.removeEventListener('render-process-gone', handleCrashed)
        }
    }, [webviewElement, handleStartLoading, handleStopLoading, handleFailLoad, handleNewWindow, handleCrashed])

    return {
        isLoading,
        error,
        activeWebviewRef,
        onWebviewRef,
        handleRetry
    }
}

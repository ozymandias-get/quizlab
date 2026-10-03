import type { WebviewElement } from '@shared-core/types/webview'

import { useEffect } from 'react'

interface UseWebviewEventsProps {
  webviewElement: WebviewElement | null
  onStartLoading: () => void
  onStopLoading: () => void
  onFailLoad: (event: Event) => void
  onNewWindow: (event: Event) => void
  onDomReady: () => void
  onCrashed: (event?: Event) => void
  onDidNavigate?: (event: Event) => void
  onDidNavigateInPage: (event: Event) => void
}

/**
 * Hook to manage native webview element event listeners.
 */
export function useWebviewEvents({
  webviewElement,
  onStartLoading,
  onStopLoading,
  onFailLoad,
  onNewWindow,
  onDomReady,
  onCrashed,
  onDidNavigate,
  onDidNavigateInPage
}: UseWebviewEventsProps) {
  useEffect(() => {
    const wv = webviewElement
    if (!wv) return

    wv.addEventListener('did-start-loading', onStartLoading)
    wv.addEventListener('did-stop-loading', onStopLoading)
    wv.addEventListener('did-fail-load', onFailLoad)
    wv.addEventListener('new-window', onNewWindow)
    wv.addEventListener('dom-ready', onDomReady)
    wv.addEventListener('render-process-gone', onCrashed)
    if (onDidNavigate) {
      wv.addEventListener('did-navigate', onDidNavigate)
    }
    wv.addEventListener('did-navigate-in-page', onDidNavigateInPage)

    return () => {
      // SECURITY: Wrap in try/catch because calling methods on a destroyed
      // <webview> element throws "Object has been destroyed" which crashes
      // the entire renderer process.  The webview may be destroyed before
      // the React cleanup runs (e.g. rapid tab switching, crash recovery).
      try {
        wv.removeEventListener('did-start-loading', onStartLoading)
        wv.removeEventListener('did-stop-loading', onStopLoading)
        wv.removeEventListener('did-fail-load', onFailLoad)
        wv.removeEventListener('new-window', onNewWindow)
        wv.removeEventListener('dom-ready', onDomReady)
        wv.removeEventListener('render-process-gone', onCrashed)
        if (onDidNavigate) {
          wv.removeEventListener('did-navigate', onDidNavigate)
        }
        wv.removeEventListener('did-navigate-in-page', onDidNavigateInPage)
      } catch {
        // Webview was already destroyed — nothing to clean up
      }
    }
  }, [
    webviewElement,
    onStartLoading,
    onStopLoading,
    onFailLoad,
    onNewWindow,
    onDomReady,
    onCrashed,
    onDidNavigate,
    onDidNavigateInPage
  ])
}

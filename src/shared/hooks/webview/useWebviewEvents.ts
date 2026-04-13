import { useEffect } from 'react'
import type { WebviewElement } from '@shared-core/types/webview'

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

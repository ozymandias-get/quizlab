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

    const subscriptions: Array<[string, EventListener]> = [
      ['did-start-loading', onStartLoading],
      ['did-stop-loading', onStopLoading],
      ['did-fail-load', onFailLoad],
      ['new-window', onNewWindow],
      ['dom-ready', onDomReady],
      ['render-process-gone', onCrashed],
      ['did-navigate-in-page', onDidNavigateInPage]
    ]
    if (onDidNavigate) subscriptions.push(['did-navigate', onDidNavigate])

    for (const [event, handler] of subscriptions) {
      wv.addEventListener(event, handler)
    }

    return () => {
      // SECURITY: Wrap each removal individually because calling methods on a
      // destroyed <webview> element throws "Object has been destroyed" which
      // crashes the entire renderer process. The webview may be destroyed
      // before the React cleanup runs (e.g. rapid tab switching, crash
      // recovery).
      //
      // One try/catch around the whole block would let the first throw skip
      // every remaining removeEventListener, so a single destroy race could
      // leave the other listeners registered on a still-live element.
      for (const [event, handler] of subscriptions) {
        try {
          wv.removeEventListener(event, handler)
        } catch {
          // Webview was already destroyed — nothing to clean up for this event
        }
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

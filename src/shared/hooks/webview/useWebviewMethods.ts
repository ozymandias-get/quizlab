import { useCallback, useMemo } from 'react'
import type { RefObject } from 'react'
import { getElectronApi } from '@shared/lib/electronApi'
import { reportSuppressedError } from '@shared/lib/logger'
import type {
  WebviewController,
  WebviewElement,
  WebviewInputEvent
} from '@shared-core/types/webview'

interface UseWebviewMethodsProps {
  activeWebviewRef: RefObject<WebviewElement | null>
  webviewElementListenersRef: RefObject<Set<(el: WebviewElement | null) => void>>
}

/**
 * Hook to provide WebviewController interface with safety checks and Reflect.apply
 */
export function useWebviewMethods({
  activeWebviewRef,
  webviewElementListenersRef
}: UseWebviewMethodsProps) {
  const withActiveWebview = useCallback(
    <T>(operation: (webview: WebviewElement) => T): T | undefined => {
      const webview = activeWebviewRef.current
      if (!webview || (typeof webview.isDestroyed === 'function' && webview.isDestroyed())) {
        return undefined
      }
      return operation(webview)
    },
    [activeWebviewRef]
  )

  const methods = useMemo<WebviewController>(
    () => ({
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
      isDestroyed: () => withActiveWebview((webview) => webview.isDestroyed?.() ?? false) ?? false,
      subscribeWebviewElement: (listener) => {
        webviewElementListenersRef.current?.add(listener)
        try {
          listener(activeWebviewRef.current)
        } catch (error) {
          reportSuppressedError('webview.subscribe.initial', { cause: error })
        }
        return () => {
          webviewElementListenersRef.current?.delete(listener)
        }
      }
    }),
    [activeWebviewRef, withActiveWebview, webviewElementListenersRef]
  )

  return methods
}

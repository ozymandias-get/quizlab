import type { WebviewElement } from '@shared-core/types/webview'

import { getElectronApi } from '@shared/lib/electronApi'
import { Logger, reportSuppressedError } from '@shared/lib/logger'

import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useCallback, useRef } from 'react'

const safeGetURL = (wv: WebviewElement | null): string | undefined => {
  if (!wv) return undefined
  try {
    return wv.getURL?.()
  } catch {
    return undefined
  }
}

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

/**
 * Guest-side cancel script run on every navigation.
 *
 * 1. `__quizlabAbortController.abort()` stops in-flight automation waits: the
 *    50 ms `__eventDrivenWait` MutationObserver loop and the 250 ms
 *    `resolveWithFallback` poll. Without this they run to their full 8-15 s
 *    budget while the page they were inspecting is being replaced.
 *
 * 2. `_aiPickerCleanup()` tears the element picker down. The picker's
 *    `iframeObserver` watches `document.documentElement` with
 *    `{ subtree: true }` and, for every mutation batch it sees, runs a
 *    whole-document `querySelectorAll('iframe')`. An SPA route change keeps the
 *    JS realm alive, so without this the armed picker survived the navigation
 *    and kept that full-subtree observer, plus its per-iframe-document
 *    observers and seven capture-phase listeners, attached to a page that no
 *    longer had an overlay to pick from. Only a full document load destroys
 *    the realm implicitly.
 *
 * Re-injecting the picker is the job of `startPicker`, which runs the cleanup
 * block again at the top of the script.
 */
const NAVIGATION_CANCEL_SCRIPT =
  'try{window.__quizlabAbortController&&window.__quizlabAbortController.abort()}catch(e){}' +
  'try{window._aiPickerCleanup&&window._aiPickerCleanup()}catch(e){}'

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

interface UseWebviewEventHandlersProps {
  activeWebviewRef: RefObject<WebviewElement | null>
  hasInitiallyLoadedRef: RefObject<boolean>
  onUrlChangeRef: RefObject<((url: string) => void) | undefined>
  onPageSettledRef: RefObject<((webview: WebviewElement) => void) | undefined>
  setIsLoading: Dispatch<SetStateAction<boolean>>
  setError: Dispatch<SetStateAction<string | null>>
  showWarning: (key: string) => void
  t: (key: string) => string
}

export function useWebviewEventHandlers({
  activeWebviewRef,
  hasInitiallyLoadedRef,
  onUrlChangeRef,
  onPageSettledRef,
  setIsLoading,
  setError,
  showWarning,
  t
}: UseWebviewEventHandlersProps) {
  const handleStartLoading = useCallback(() => {
    setError(null)

    if (hasInitiallyLoadedRef.current) {
      return
    }
    setIsLoading(true)
  }, [hasInitiallyLoadedRef, setError, setIsLoading])

  const handleStopLoading = useCallback(() => {
    setIsLoading(false)
    hasInitiallyLoadedRef.current = true
    const onPageSettledCb = onPageSettledRef.current
    if (onPageSettledCb) {
      const wv = activeWebviewRef.current
      if (wv) onPageSettledCb(wv)
    }
  }, [activeWebviewRef, hasInitiallyLoadedRef, onPageSettledRef, setIsLoading])

  const handleFailLoad = useCallback(
    (event: Event) => {
      const failEvent = event as FailLoadEvent
      setIsLoading(false)

      const errorCode = failEvent.errorCode
      if (errorCode !== undefined && TRANSIENT_ERROR_CODES.has(errorCode)) {
        return
      }

      const description = failEvent.errorDescription
      setError(description && description.length > 0 ? description : t('page_load_failed'))
    },
    [t, setError, setIsLoading]
  )

  const handleNewWindow = useCallback(
    async (event: Event) => {
      event.preventDefault()
      const newWindowEvent = event as NewWindowEvent
      const url = newWindowEvent.url

      try {
        if (!url) return
        const targetUrl = new URL(url)
        const api = getElectronApi()
        if (!api) return

        if (await api.isAuthDomain(targetUrl.hostname)) return

        const currentRawUrl = safeGetURL(activeWebviewRef.current)
        const currentOrigin = currentRawUrl ? new URL(currentRawUrl).origin : null
        const isSameOrigin = currentOrigin === targetUrl.origin

        if (isSameOrigin) {
          await activeWebviewRef.current?.loadURL?.(url).catch(() => {})
          return
        }

        await api.openExternal(url)
      } catch (err) {
        Logger.error('[Webview] New window error:', err)
        showWarning('toast_open_link_failed')
      }
    },
    [activeWebviewRef, showWarning]
  )

  const cssInjectedRef = useRef(new WeakSet<object>())

  // Best-effort teardown of everything the host injected into the guest page:
  // in-flight automation runs (wait loops, MutationObservers) and the element
  // picker overlay. Runs on SPA navigation / new-chat transitions instead of
  // letting them continue on a page that is being replaced.
  const teardownGuestState = useCallback((wv: WebviewElement | null) => {
    if (!wv) return
    try {
      const promise = wv.executeJavaScript?.(NAVIGATION_CANCEL_SCRIPT)
      promise?.catch(() => {})
    } catch {
      // Navigation may already have destroyed the guest context — safe to skip
    }
  }, [])

  const handleDomReady = useCallback(() => {
    const wv = activeWebviewRef.current

    if (wv && !cssInjectedRef.current.has(wv)) {
      cssInjectedRef.current.add(wv)
      wv.insertCSS?.(WEBVIEW_SCROLLBAR_CSS).catch((err) =>
        reportSuppressedError('webview.insertCSS.scrollbar', { cause: err })
      )
    }
    const onUrlChangeCb = onUrlChangeRef.current
    if (onUrlChangeCb) {
      const url = safeGetURL(wv)
      if (url) onUrlChangeCb(url)
    }
  }, [activeWebviewRef, onUrlChangeRef])

  const handleDidNavigateInPage = useCallback(
    (event: Event) => {
      const url = extractEventUrl(event)

      teardownGuestState(activeWebviewRef.current)

      if (!url) return

      const onUrlChangeCb = onUrlChangeRef.current
      if (onUrlChangeCb) onUrlChangeCb(url)
    },
    [teardownGuestState, activeWebviewRef, onUrlChangeRef]
  )

  const handleDidNavigate = useCallback(
    (event: Event) => {
      const url = extractEventUrl(event)

      teardownGuestState(activeWebviewRef.current)

      const onUrlChangeCb = onUrlChangeRef.current
      if (url && onUrlChangeCb) onUrlChangeCb(url)
    },
    [teardownGuestState, activeWebviewRef, onUrlChangeRef]
  )

  return {
    handleStartLoading,
    handleStopLoading,
    handleFailLoad,
    handleNewWindow,
    handleDomReady,
    handleDidNavigateInPage,
    handleDidNavigate
  }
}

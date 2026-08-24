import { useToastStore } from '@shared/stores/toastStore'

import i18next from 'i18next'

import { ensureErrorMessage } from './errorUtils'
import { Logger } from './logger'

/**
 * Global error reporting for errors that React's ErrorBoundary cannot see:
 * errors thrown inside async `useEffect` bodies, event handlers and promise
 * chains (`unhandledrejection`) plus uncaught `window` errors. Without this,
 * the user would see nothing when a background async load fails.
 *
 * Respects `event.defaultPrevented` so purpose-built guards
 * (e.g. the pdf.js render guard) can swallow expected rejections silently.
 */

const BENIGN_MESSAGE_MARKERS = ['ResizeObserver loop', 'Script error.']

function isBenignError(error: unknown): boolean {
  if (error === undefined || error === null) return true
  const message = ensureErrorMessage(error, '')
  return BENIGN_MESSAGE_MARKERS.some((marker) => message.includes(marker))
}

function reportError(error: unknown): void {
  if (isBenignError(error)) return
  Logger.error('[GlobalErrorHandler] Uncaught error:', error)

  const message = ensureErrorMessage(error)
  const shown = i18next.t('toast_unhandled_error', { error: message.slice(0, 200) })
  useToastStore.getState().showError(shown, i18next.t('toast_error_title'), undefined, 8000)
}

let installed = false

/** Installs global `error` / `unhandledrejection` handlers. Returns an uninstall function. */
export function installGlobalErrorHandlers(): () => void {
  if (installed || typeof window === 'undefined') return () => {}
  installed = true

  const handleRejection = (event: PromiseRejectionEvent) => {
    if (event.defaultPrevented) return
    reportError(event.reason)
  }
  const handleError = (event: ErrorEvent) => {
    if (event.defaultPrevented) return
    reportError(event.error ?? event.message)
  }

  window.addEventListener('unhandledrejection', handleRejection)
  window.addEventListener('error', handleError)

  return () => {
    window.removeEventListener('unhandledrejection', handleRejection)
    window.removeEventListener('error', handleError)
    installed = false
  }
}

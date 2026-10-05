/**
 * Safety net for pdf.js render lifecycle races.
 *
 * pdf.js rejects a cancelled render task with `RenderingCancelledException`
 * (a `BaseException` subclass, so `error.name === 'RenderingCancelledException'`)
 * and throws when `render()` is called on a canvas whose previous task has not
 * released it yet. @react-pdf-viewer catches both in the happy path, but across
 * Viewer remounts (reload key changes) and zoom+navigation races the rejection
 * can escape as an unhandled rejection and reach the browser's default console
 * reporting.
 *
 * Both conditions are expected and benign, so this guard calls
 * `preventDefault()` to keep them out of the console.
 *
 * Scope note: `preventDefault()` does **not** suppress the in-app toast. That is
 * `shared/lib/globalErrorHandlers`, which honours `defaultPrevented` but is
 * installed at boot (`app/main.tsx`) and therefore receives `unhandledrejection`
 * before this lazily-mounted guard does. Swallowing the toast would need a
 * shared benign-error registry; that is not worth the cross-module coupling for
 * a message that is only noise.
 *
 * The markers below were checked against the pinned `pdfjs-dist@3.11.174` and
 * `@react-pdf-viewer/core@3.12.0` bundles. `enableScripting`-era pdf.js messages
 * that those versions do not contain were removed rather than left to match
 * unrelated errors by accident.
 */

import { ensureErrorMessage } from '@shared/lib/errorUtils'

/** Error name pdf.js assigns to a cancelled render task. */
const CANCELLED_RENDER_ERROR_NAME = 'RenderingCancelledException'

/** Substrings of the two messages pdf.js actually throws for a render race. */
const IGNORED_RENDER_ERROR_MARKERS = ['rendering cancelled', 'multiple render() operations']

export function isIgnorablePdfRenderError(error: unknown): boolean {
  // Exact-name match first: it is the only signal that survives pdf.js
  // replacing the human-readable message with its own error object.
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === CANCELLED_RENDER_ERROR_NAME
  ) {
    return true
  }
  const normalized = ensureErrorMessage(error, '').toLowerCase()
  return IGNORED_RENDER_ERROR_MARKERS.some((marker) => normalized.includes(marker))
}

/**
 * Installs the global unhandled-rejection filter that swallows pdf.js render
 * cancellation races. Returns an uninstall function.
 */
export function installPdfRenderErrorGuard(): () => void {
  const handleRejection = (event: PromiseRejectionEvent) => {
    if (isIgnorablePdfRenderError(event.reason)) {
      event.preventDefault()
    }
  }
  window.addEventListener('unhandledrejection', handleRejection)
  return () => {
    window.removeEventListener('unhandledrejection', handleRejection)
  }
}

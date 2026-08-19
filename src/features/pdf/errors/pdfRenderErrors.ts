/**
 * Safety net for pdf.js render lifecycle races.
 *
 * pdf.js rejects cancelled render tasks with RenderingCancelledException and
 * throws "canvas context is locked"-style errors when render() is invoked on a
 * canvas whose previous task has not fully released the context (fast
 * scrolling / zooming in SinglePage mode). @react-pdf-viewer catches these in
 * the happy path, but during Viewer remounts (reload key changes) and
 * zoom+navigation races the rejection can escape as an unhandled rejection.
 *
 * These errors are expected, benign side effects of the viewer's own
 * cancellation logic — they must never reach the console as uncaught errors.
 */

const IGNORED_RENDER_ERROR_MARKERS = [
  'renderingcancelledexception',
  'rendering cancelled',
  'render() was canceled',
  'canvas context is locked',
  'multiple render() operations'
]

export function isIgnorablePdfRenderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  return IGNORED_RENDER_ERROR_MARKERS.some((marker) => normalized.includes(marker))
}

/**
 * Installs a global unhandled-rejection filter that swallows pdf.js render
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

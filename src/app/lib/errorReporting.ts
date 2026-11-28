import { installPdfRenderErrorGuard } from '@features/pdf'

import { installGlobalErrorHandlers } from '@shared/lib/globalErrorHandlers'

/**
 * Installs the renderer's unhandled-error reporting in the one order that works.
 *
 * The pdf.js guard silences expected render-cancellation rejections by calling
 * `preventDefault()`; the reporter skips events whose default was already
 * prevented. Window listeners run in registration order, so a guard installed
 * after the reporter cannot stop it from showing a toast for a cancellation
 * that is routine. Installing the guard first is what makes the two agree.
 *
 * Returns an uninstall function; both listeners are removed in reverse order.
 */
export function installErrorReporting(): () => void {
  const uninstallGuard = installPdfRenderErrorGuard()
  const uninstallReporter = installGlobalErrorHandlers()
  return () => {
    uninstallReporter()
    uninstallGuard()
  }
}

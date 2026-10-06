/**
 * Native PDF.js 6 worker wiring.
 *
 * ## Why this file exists and why it is so small
 *
 * During the migration two PDF.js runtimes are installed side by side:
 *
 *   - `pdfjs-dist@3.11.174` — owned by `@react-pdf-viewer`, configured by
 *     `features/pdf/ui/components/PdfWorkerHost.tsx`
 *   - `pdfjs-6` (an alias of `pdfjs-dist@6.4.299`) — owned by the native engine
 *
 * Each runtime has its own `GlobalWorkerOptions` module instance, so the two
 * never share a worker. This module only ever touches the `pdfjs-6` one; the
 * architecture test `src/__tests__/architecture/pdfjs-dual-runtime.test.ts`
 * asserts that the `pdfjs-dist` namespace is left alone.
 *
 * ## workerSrc vs workerPort
 *
 * `workerSrc` is used deliberately.
 *
 * `workerPort` would make the `Worker` instance explicit, but it also moves the
 * worker's whole lifetime — construction, transfer of the port, teardown — into
 * this code, and pdf.js would no longer reuse the global worker itself. The
 * "one worker per runtime" invariant is a property of `workerSrc` already:
 * pdf.js lazily creates a single `PDFWorker` bound to the module instance it was
 * configured on. That is the same mechanism the legacy path relies on, so the
 * native path inherits a proven pattern instead of inventing a new one.
 *
 * ## Remove with the rest of the dual-runtime scaffolding
 *
 * When the viewer is deleted, this file disappears and the engine imports
 * `pdfjs-dist` directly. See the exit plan in `docs/pdfjs-migration-plan.md`.
 */
import { GlobalWorkerOptions } from 'pdfjs-6'
import workerUrl from 'pdfjs-6/build/pdf.worker.min.mjs?url'

/**
 * The worker asset URL as resolved by the bundler. Exported so tests can assert
 * the worker is pointed at the 6.x `.mjs` build rather than the legacy `.js` one.
 */
export const nativeWorkerUrl: string = workerUrl

let configured = false

/**
 * Publish the native worker URL to the `pdfjs-6` runtime exactly once.
 *
 * Idempotent by design: callers (currently `documentManager`) invoke it before
 * every load, so a second document must not re-assign the URL. Assigning the
 * same value twice is harmless in pdf.js but would defeat the idempotency test,
 * so the flag is what makes the guarantee observable.
 */
export function initializeNativePdfWorker(): void {
  if (configured) return
  GlobalWorkerOptions.workerSrc = nativeWorkerUrl
  configured = true
}

/** Test seam: resets the once-only guard so idempotency can be re-asserted. */
export function resetNativePdfWorkerForTests(): void {
  configured = false
}

/**
 * PDF.js worker wiring — the single worker source for the whole app.
 *
 * ## Why this file exists and why it is so small
 *
 * `pdfjs-dist` is pinned to an exact version and the engine and its worker are the
 * *same* dependency, so the worker URL has to come from that exact package or the
 * engine could be handed a worker from a different major. That is the whole job:
 * publish the bundler-resolved URL to PDF.js once.
 *
 * This is the only place in the codebase that assigns
 * `GlobalWorkerOptions.workerSrc`, which
 * `src/__tests__/architecture/pdfjs-single-runtime.test.ts` asserts.
 *
 * ## workerSrc vs workerPort
 *
 * `workerSrc` is used deliberately.
 *
 * `workerPort` would make the `Worker` instance explicit, but it also moves the
 * worker's whole lifetime — construction, transfer of the port, teardown — into
 * this code, and pdf.js would no longer reuse the global worker itself. The
 * "one worker" invariant is a property of `workerSrc` already: pdf.js lazily
 * creates a single `PDFWorker` bound to the module instance it was configured on.
 *
 * ## Why it is assigned exactly once
 *
 * Callers invoke `initializeNativePdfWorker()` before every load, so a second
 * document must not re-assign the URL. Assigning the same value twice is harmless
 * in pdf.js but would defeat the idempotency test, so the flag is what makes the
 * guarantee observable.
 */
import { GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/**
 * The worker asset URL as resolved by the bundler. Exported so tests can assert
 * the worker is pointed at the 6.x `.mjs` build rather than the legacy `.js` one.
 */
export const nativeWorkerUrl: string = workerUrl

let configured = false

/**
 * Publish the native worker URL to the `pdfjs-dist` runtime exactly once.
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

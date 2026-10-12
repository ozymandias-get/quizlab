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
 * ## Why the URL is built from `pdfjs/`, not imported with `?url`
 *
 * The worker is staged next to the other PDF.js runtime assets by
 * `vite.config.mts` and addressed through `pdfWorkerUrl()`. Importing it as
 * `pdfjs-dist/build/pdf.worker.min.mjs?url` instead makes the dev server serve
 * the worker through Vite's *transform* pipeline, which injects an HMR client
 * into a `Worker` global that cannot act on the lifecycle messages it then
 * receives. pdf.js silently degrades to its main-thread "fake worker" and the
 * document renders from the UI thread. See `pdfWorkerUrl()` for the full
 * account; the short version is that the worker must be served as plain bytes.
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

import { pdfWorkerUrl } from './pdfDocumentOptions'

/**
 * The staged worker asset URL. Exported so tests can assert
 * `GlobalWorkerOptions.workerSrc` points at the 6.x `.mjs` build.
 */
export const nativeWorkerUrl: string = pdfWorkerUrl()

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

/**
 * Unit tests for the PDF worker configuration.
 *
 * One runtime, one worker. During the migration this file also asserted that the
 * native engine never mutated the legacy `GlobalWorkerOptions`, which was the
 * right thing to pin while `@react-pdf-viewer` was still shipping. That
 * relationship cannot exist any more: there is a single `pdfjs-dist`, a single
 * `GlobalWorkerOptions`, and the interesting question is whether *anything else*
 * can re-point it — which is what the idempotency and re-apply cases below cover
 * against the real module instance.
 */
import {
  initializeNativePdfWorker,
  nativeWorkerUrl,
  resetNativePdfWorkerForTests
} from '@features/pdf/engine/pdfWorker'

import { GlobalWorkerOptions } from 'pdfjs-dist'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('pdf worker', () => {
  beforeEach(() => {
    resetNativePdfWorkerForTests()
  })

  afterEach(() => {
    resetNativePdfWorkerForTests()
  })

  it('resolves the worker URL to the 6.x ESM build', () => {
    expect(nativeWorkerUrl).toBeTruthy()
    expect(nativeWorkerUrl).toContain('pdf.worker.min')
    // PDF.js 6 ships `pdf.worker.min.mjs`. The 3.x `.js` file the legacy viewer
    // imported does not exist in this package any more, so a `.js` URL here would
    // be a 404 that only shows up as a blank page at runtime.
    expect(nativeWorkerUrl.endsWith('.mjs')).toBe(true)
    expect(nativeWorkerUrl.endsWith('.js')).toBe(false)
  })

  it('publishes the worker URL to the runtime on first init', () => {
    initializeNativePdfWorker()

    expect(GlobalWorkerOptions.workerSrc).toBe(nativeWorkerUrl)
  })

  it('is idempotent', () => {
    initializeNativePdfWorker()
    const afterFirst = GlobalWorkerOptions.workerSrc

    initializeNativePdfWorker()
    initializeNativePdfWorker()

    expect(GlobalWorkerOptions.workerSrc).toBe(afterFirst)
  })

  it('re-applies the URL after a reset, proving the guard is the only gate', () => {
    initializeNativePdfWorker()
    resetNativePdfWorkerForTests()
    GlobalWorkerOptions.workerSrc = 'blob:tampered'

    initializeNativePdfWorker()

    expect(GlobalWorkerOptions.workerSrc).toBe(nativeWorkerUrl)
  })

  it('never uses workerPort, so the worker stays lazily created by PDF.js', () => {
    initializeNativePdfWorker()

    // `workerPort` would move the worker's whole lifetime into our code and stop
    // PDF.js reusing its global worker. `workerSrc` is what makes "one worker per
    // app" a property of PDF.js rather than something we have to maintain.
    expect(GlobalWorkerOptions.workerPort ?? null).toBeNull()
  })
})

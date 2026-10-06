/**
 * Unit tests for the native worker configuration and the dual-runtime boundary.
 *
 * The `pdfjs-dist` namespace assertions are the point of this file. Two PDF.js
 * versions are installed on purpose during the migration, and each has its own
 * `GlobalWorkerOptions` module instance. If the native engine ever mutated the
 * legacy one, `@react-pdf-viewer` would start loading a 6.x worker against a
 * 3.x engine — a failure that would only show up as a blank page at runtime.
 */
import {
  initializeNativePdfWorker,
  nativeWorkerUrl,
  resetNativePdfWorkerForTests
} from '@features/pdf/engine/pdfWorker'

import { GlobalWorkerOptions as legacyGlobalWorkerOptions } from 'pdfjs-dist'
import { GlobalWorkerOptions as nativeGlobalWorkerOptions } from 'pdfjs-6'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('native pdfjs worker', () => {
  beforeEach(() => {
    resetNativePdfWorkerForTests()
  })

  afterEach(() => {
    resetNativePdfWorkerForTests()
  })

  it('resolves the worker URL to the 6.x ESM build', () => {
    expect(nativeWorkerUrl).toBeTruthy()
    // The legacy path still imports pdf.worker.min.js; the native path must not
    // be pointing at that file, which no longer exists in 6.x.
    expect(nativeWorkerUrl).toContain('pdf.worker.min')
    expect(nativeWorkerUrl.endsWith('.mjs')).toBe(true)
  })

  it('publishes the worker URL to the native runtime on first init', () => {
    initializeNativePdfWorker()

    expect(nativeGlobalWorkerOptions.workerSrc).toBe(nativeWorkerUrl)
  })

  it('is idempotent', () => {
    initializeNativePdfWorker()
    const afterFirst = nativeGlobalWorkerOptions.workerSrc

    initializeNativePdfWorker()
    initializeNativePdfWorker()

    expect(nativeGlobalWorkerOptions.workerSrc).toBe(afterFirst)
  })

  it('re-applies the URL after a reset, proving the guard is the only gate', () => {
    initializeNativePdfWorker()
    resetNativePdfWorkerForTests()
    nativeGlobalWorkerOptions.workerSrc = 'blob:tampered'

    initializeNativePdfWorker()

    expect(nativeGlobalWorkerOptions.workerSrc).toBe(nativeWorkerUrl)
  })
})

describe('dual-runtime isolation', () => {
  const LEGACY_SENTINEL = 'blob:legacy-viewer-worker'

  beforeEach(() => {
    resetNativePdfWorkerForTests()
  })

  afterEach(() => {
    resetNativePdfWorkerForTests()
  })

  it('resolves the two runtimes to different GlobalWorkerOptions instances', () => {
    expect(nativeGlobalWorkerOptions).not.toBe(legacyGlobalWorkerOptions)
  })

  it('resolves the two runtimes to different pdfjs versions', async () => {
    const legacy = (await import('pdfjs-dist')) as unknown as { version: string }
    const native = (await import('pdfjs-6')) as unknown as { version: string }

    expect(legacy.version).not.toBe(native.version)
    expect(native.version).toBe('6.4.299')
  })

  it('leaves the legacy worker configuration untouched', () => {
    legacyGlobalWorkerOptions.workerSrc = LEGACY_SENTINEL

    initializeNativePdfWorker()

    expect(legacyGlobalWorkerOptions.workerSrc).toBe(LEGACY_SENTINEL)
    expect(nativeGlobalWorkerOptions.workerSrc).toBe(nativeWorkerUrl)
  })

  it('never shares a worker port between the runtimes', () => {
    legacyGlobalWorkerOptions.workerSrc = LEGACY_SENTINEL

    initializeNativePdfWorker()

    // workerPort belongs to whichever runtime owns it; the engine must leave the
    // legacy one alone so a shared port can never be handed across versions.
    expect(legacyGlobalWorkerOptions.workerPort ?? null).toBeNull()
    expect(nativeGlobalWorkerOptions.workerPort ?? null).toBeNull()
  })
})

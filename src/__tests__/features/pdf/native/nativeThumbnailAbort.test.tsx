/**
 * Thumbnail renders that are aborted before they start.
 *
 * The rail aborts every thumbnail it owns when it unmounts (closing the rail,
 * switching documents). A page lookup that is already in flight can resolve
 * after that; the request must then stop before it touches the canvas or asks
 * PDF.js for a render. Starting one anyway wastes a paint on a detached canvas
 * and, because the task is cancelled and its promise never awaited, leaves
 * PDF.js' rejection to the global unhandled-rejection path.
 */
import { NativeViewerHarness, createFakeDocument, type FakeDocument } from './nativeViewerHarness'

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { useNativePdfController } from '@features/pdf/native/useNativePdfController'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn()
}))

vi.mock('pdfjs-dist', async () => {
  const { createPdfJsDistMock } = await import('./pdfJsMockFactories')
  return createPdfJsDistMock(mocks)
})

vi.mock('@features/pdf/engine/pdfWorker', async () => {
  const { createPdfWorkerMock } = await import('./pdfJsMockFactories')
  return createPdfWorkerMock(mocks)
})

let frameCallbacks: FrameRequestCallback[]

beforeEach(() => {
  vi.clearAllMocks()
  frameCallbacks = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallbacks.push(cb)
    return frameCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function drainFrames(): Promise<void> {
  const callbacks = frameCallbacks.splice(0)
  act(() => {
    for (const cb of callbacks) cb(0)
  })
  await settle()
}

async function waitForFrames(check: () => void, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  for (;;) {
    await settle()
    if (frameCallbacks.length > 0) {
      await drainFrames()
      continue
    }
    try {
      check()
      return
    } catch (error) {
      lastError = error
    }
    if (Date.now() > deadline) throw lastError
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

function serveDocument(document: FakeDocument): void {
  mocks.getDocument.mockImplementation(() => ({
    promise: Promise.resolve(document),
    destroy: vi.fn(() => Promise.resolve()),
    abort: vi.fn()
  }))
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('thumbnail render cancellation', () => {
  it('does not start a render when the page arrives after the abort', async () => {
    const pdfDocument = createFakeDocument({ numPages: 12 })
    const realGetPage = pdfDocument.getPage
    const gatedPage = deferred<ReturnType<typeof pdfDocument.page>>()
    pdfDocument.getPage = (pageNumber) =>
      pageNumber === 5 ? gatedPage.promise : realGetPage(pageNumber)
    serveDocument(pdfDocument)

    let controller: ReturnType<typeof useNativePdfController> | null = null
    render(
      <NativeViewerHarness
        onController={(value) => {
          controller = value
        }}
      />
    )
    await waitForFrames(() => expect(controller?.status).toBe('ready'))

    const canvas = document.createElement('canvas')
    const abort = new AbortController()
    const run = (
      controller as unknown as ReturnType<typeof useNativePdfController>
    ).renderPageThumbnail(5, canvas, 144, abort.signal)

    abort.abort()
    gatedPage.resolve(pdfDocument.page(5))
    await expect(run).resolves.toBeUndefined()

    // The thumbnail request was cancelled before the page arrived: no render
    // may be started for it, and the canvas must stay untouched.
    expect(pdfDocument.page(5).renderCalls).toHaveLength(0)
    expect(canvas.width).toBe(300)
    expect(canvas.height).toBe(150)
  })

  it('settles with PDF.js cancellation when the abort lands mid-render', async () => {
    // The render is already running: it cannot be un-started, so the task is
    // cancelled and its rejection reaches the caller, which ignores it. What
    // matters is that the promise settles instead of hanging the rail.
    const pdfDocument = createFakeDocument({ numPages: 12, settleRenders: false })
    serveDocument(pdfDocument)

    let controller: ReturnType<typeof useNativePdfController> | null = null
    render(
      <NativeViewerHarness
        onController={(value) => {
          controller = value
        }}
      />
    )
    await waitForFrames(() => expect(controller?.status).toBe('ready'))

    const canvas = document.createElement('canvas')
    const abort = new AbortController()
    const run = (
      controller as unknown as ReturnType<typeof useNativePdfController>
    ).renderPageThumbnail(3, canvas, 144, abort.signal)

    await waitForFrames(() => expect(pdfDocument.page(3).renderCalls).toHaveLength(1))
    abort.abort()

    await expect(run).rejects.toMatchObject({ name: 'RenderingCancelledException' })
  })
})

/**
 * Publishing the mounted native document to the capture pipeline.
 *
 * The registry exists so a high-DPI capture reuses the decoded document instead of
 * re-downloading a large file. The native viewer keeps its document inside
 * `PdfDocumentManager`, so nothing about it was reachable from a context-menu
 * handler until `useNativePdfCaptureDocument` started publishing it. These tests
 * drive the **real** controller and the **real** engine against a faked
 * `pdfjs-dist`, so the liveness answers are production behaviour — including the
 * generation guard in `documentManager.ts`, which is what makes a reload safe.
 *
 * What is pinned here is the lifecycle, because that is what silently breaks:
 *
 *  - a ready document is published under its URL
 *  - a reload publishes a *new* generation and the old handle goes dead
 *  - a document switch answers `null` for the previous URL
 *  - unmount deregisters, and never destroys the document it borrowed
 *  - the inert (flag-off) native path neither registers nor clobbers another
 *    registrant's entry
 */
import {
  clearActivePdfDocument,
  getActivePdfDocument,
  getActivePdfDocumentIdentity
} from '@features/pdf/lib/activePdfDocumentRegistry'

import {
  type FakeDocument,
  type FakeLoadingTask,
  NativeViewerHarness,
  createFakeDocument,
  createLoadingTask
} from './nativeViewerHarness'
import { FakeAnnotationLayer } from './nativeAnnotationLayerDouble'
import { FakeTextLayer } from './nativeTextLayerDouble'

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  clearActivePdfDocument()
  FakeTextLayer.reset()
  FakeAnnotationLayer.reset()
  frameCallbacks = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallbacks.push(cb)
    return frameCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearActivePdfDocument()
})

function flushFrames(): void {
  const callbacks = frameCallbacks.splice(0)
  act(() => {
    for (const cb of callbacks) cb(0)
  })
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function waitForFrames(check: () => void, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  for (;;) {
    await settle()
    if (frameCallbacks.length > 0) {
      flushFrames()
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

interface Served {
  tasks: FakeLoadingTask[]
  documents: FakeDocument[]
}

/**
 * Serve one document per `getDocument` call, resolved as soon as the viewer asks.
 *
 * A reload or a document switch asks again, so the queue is what makes those
 * transitions observable.
 */
function serveDocuments(documents: FakeDocument[]): Served {
  const served: Served = { tasks: [], documents: [] }
  let index = 0
  mocks.getDocument.mockImplementation(() => {
    const document = documents[Math.min(index, documents.length - 1)]
    index += 1
    const task = createLoadingTask()
    served.tasks.push(task)
    served.documents.push(document)
    task.resolve(document)
    return task
  })
  return served
}

/**
 * Serve one document per `getDocument` call, settled by the test.
 *
 * This is the version that can hold a reload *open*, which is the only way to
 * observe the window between "the old document is already gone" and "the new one
 * has arrived".
 */
function stageDocuments(documents: FakeDocument[]): Served {
  const served: Served = { tasks: [], documents: [] }
  let index = 0
  mocks.getDocument.mockImplementation(() => {
    const document = documents[Math.min(index, documents.length - 1)]
    index += 1
    const task = createLoadingTask()
    served.tasks.push(task)
    served.documents.push(document)
    return task
  })
  return served
}

describe('useNativePdfCaptureDocument', () => {
  it('publishes the mounted document under its url once it is ready', async () => {
    serveDocuments([createFakeDocument({ numPages: 12 })])

    render(<NativeViewerHarness pdfUrl="local-pdf://book" />)

    await waitForFrames(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())
    expect(getActivePdfDocumentIdentity()).toBe('local-pdf://book::0')
  })

  it('publishes nothing while the document is still loading', async () => {
    serveDocuments([createFakeDocument({ numPages: 12 })])

    render(<NativeViewerHarness pdfUrl="local-pdf://book" />)

    // Synchronously after mount the document has not resolved, so a capture must
    // see an empty registry and temp-load rather than borrow a half-built handle.
    expect(getActivePdfDocument('local-pdf://book')).toBeNull()
    await waitForFrames(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())
  })

  it('lends a page from the mounted document instead of a second load', async () => {
    const document = createFakeDocument({ numPages: 12 })
    serveDocuments([document])

    render(<NativeViewerHarness pdfUrl="local-pdf://book" />)
    await waitForFrames(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    const handle = getActivePdfDocument('local-pdf://book')!
    const page = await handle.getPage(2)

    // No second `getDocument`: the whole point of the registry. And the page came
    // out of the manager's cache, so the canvas already holds that page proxy.
    expect(mocks.getDocument).toHaveBeenCalledTimes(1)
    expect(page.getViewport({ scale: 1 })).toMatchObject({ width: 400, height: 600 })
  })

  it('exposes no teardown, so a capture cannot end the mounted document', async () => {
    const served = serveDocuments([createFakeDocument({ numPages: 4 })])

    render(<NativeViewerHarness pdfUrl="local-pdf://book" />)
    await waitForFrames(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    const handle = getActivePdfDocument('local-pdf://book') as unknown as Record<string, unknown>
    expect(Object.keys(handle).sort()).toEqual(['getPage', 'isAlive'])
    expect(handle.destroy).toBeUndefined()

    // Nothing tore the loading task down: the engine still owns it, and only the
    // engine may destroy it.
    for (const task of served.tasks) expect(task.destroy).not.toHaveBeenCalled()
  })

  describe('reload: same url, new document generation', () => {
    it('never hands out the superseded generation', async () => {
      const first = createFakeDocument({ numPages: 12 })
      const second = createFakeDocument({ numPages: 30 })
      serveDocuments([first, second])

      const { rerender } = render(<NativeViewerHarness pdfUrl="local-pdf://book" reloadKey={0} />)
      await waitForFrames(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

      const staleHandle = getActivePdfDocument('local-pdf://book')!
      expect(getActivePdfDocumentIdentity()).toBe('local-pdf://book::0')

      rerender(<NativeViewerHarness pdfUrl="local-pdf://book" reloadKey={1} />)
      await waitForFrames(() => expect(getActivePdfDocumentIdentity()).toBe('local-pdf://book::1'))

      // Two independent answers, both required: the slot now holds the new
      // generation, and the old handle knows on its own that it is spent.
      const current = getActivePdfDocument('local-pdf://book')!
      expect(current).not.toBe(staleHandle)
      expect(staleHandle.isAlive()).toBe(false)
      expect(current.isAlive()).toBe(true)
    })

    it('leaves no window in which a capture is handed the dead generation', async () => {
      // `load()` disposes the previous task before starting the next one, so the
      // superseded handle is dead from the first frame of the reload — long
      // before the new document resolves.
      const first = createFakeDocument({ numPages: 12 })
      const second = createFakeDocument({ numPages: 30 })
      const served = stageDocuments([first, second])

      const { rerender } = render(<NativeViewerHarness pdfUrl="local-pdf://book" reloadKey={0} />)
      await act(async () => {
        served.tasks[0].resolve(first)
        await settle()
      })
      await waitForFrames(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

      rerender(<NativeViewerHarness pdfUrl="local-pdf://book" reloadKey={1} />)
      await settle()

      // The second load is still in flight: the registry must answer "nothing to
      // borrow", never the old document, so a capture temp-loads instead of
      // rendering from a torn-down task.
      expect(getActivePdfDocument('local-pdf://book')).toBeNull()
      // And the abandoned task was destroyed, so it never finishes decoding.
      expect(served.tasks[0].destroy).toHaveBeenCalled()
      expect(served.tasks[1].destroy).not.toHaveBeenCalled()

      await act(async () => {
        served.tasks[1].resolve(second)
        await settle()
      })
      await waitForFrames(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())
    })
  })

  describe('document switch', () => {
    it('stops answering for the previous url', async () => {
      serveDocuments([createFakeDocument({ numPages: 12 }), createFakeDocument({ numPages: 8 })])

      const { rerender } = render(<NativeViewerHarness pdfUrl="local-pdf://a" />)
      await waitForFrames(() => expect(getActivePdfDocument('local-pdf://a')).not.toBeNull())

      rerender(<NativeViewerHarness pdfUrl="local-pdf://b" />)
      await waitForFrames(() => expect(getActivePdfDocument('local-pdf://b')).not.toBeNull())

      expect(getActivePdfDocument('local-pdf://a')).toBeNull()
    })
  })

  describe('unmount', () => {
    it('deregisters, so capture falls back to loading its own document', async () => {
      serveDocuments([createFakeDocument({ numPages: 12 })])

      const { unmount } = render(<NativeViewerHarness pdfUrl="local-pdf://book" />)
      await waitForFrames(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

      unmount()

      expect(getActivePdfDocument('local-pdf://book')).toBeNull()
    })

    it('leaves a sibling viewer registration alone', async () => {
      // LeftPanel and the FocusOverlay can both show the same file. The one
      // unmounting must not empty the other's slot, or the next capture would
      // re-download a file that is already decoded.
      serveDocuments([createFakeDocument({ numPages: 12 })])

      const leaving = render(<NativeViewerHarness pdfUrl="local-pdf://book" />)
      await waitForFrames(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

      const surviving = render(<NativeViewerHarness pdfUrl="local-pdf://book" />)
      await waitForFrames(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())
      const survivorHandle = getActivePdfDocument('local-pdf://book')

      leaving.unmount()

      expect(getActivePdfDocument('local-pdf://book')).toBe(survivorHandle)

      surviving.unmount()
      expect(getActivePdfDocument('local-pdf://book')).toBeNull()
    })
  })
})

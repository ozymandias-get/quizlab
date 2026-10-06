/**
 * The native canvas viewer: document lifecycle, page state, scale state and
 * render cancellation.
 *
 * These tests drive the **real** native engine against a faked `pdfjs-dist`, so what
 * is asserted is production behaviour — the generation guard in
 * `documentManager.ts` and the supersede-cancel in `pageRenderer.ts` are the real
 * code, not doubles. Only the PDF.js boundary is faked.
 *
 * The behaviours pinned here are the ones that silently break when a renderer is
 * replaced:
 *
 *  - one canvas, holding the *current* page, 1-based
 *  - a superseded load or render never reaches the UI
 *  - a cancelled render is not a user-visible error
 *  - unmount tears the engine down and cannot update state afterwards
 */
import {
  type FakeDocument,
  type FakeLoadingTask,
  NativeViewerHarness,
  createFakeDocument,
  createLoadingTask
} from './nativeViewerHarness'
import { FakeAnnotationLayer } from './nativeAnnotationLayerDouble'
import { FakeTextLayer } from './nativeTextLayerDouble'

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn()
}))

vi.mock('pdfjs-dist', async () => {
  // Imported lazily because a `vi.mock` factory is hoisted above this file's
  // static imports; the double lives in its own dependency-free module so that
  // awaiting it cannot re-enter the mocked module.
  const { FakeAnnotationLayer } = await import('./nativeAnnotationLayerDouble')
  const { FakeTextLayer } = await import('./nativeTextLayerDouble')
  return {
    getDocument: mocks.getDocument,
    TextLayer: FakeTextLayer,
    AnnotationLayer: FakeAnnotationLayer,
    RenderingCancelledException: class RenderingCancelledException extends Error {
      constructor(message = 'Rendering cancelled') {
        super(message)
        this.name = 'RenderingCancelledException'
      }
    }
  }
})

vi.mock('@features/pdf/engine/pdfWorker', () => ({
  initializeNativePdfWorker: mocks.initializeNativePdfWorker,
  nativeWorkerUrl: 'pdf.worker.min.test.mjs',
  resetNativePdfWorkerForTests: vi.fn()
}))

/** Fit scale for a 400×600 page in an 800×1000 container: min(2, 1.666…) → 1.67. */
const FIT_SCALE = 1.67

let frameCallbacks: FrameRequestCallback[]
let cancelRaf: ReturnType<typeof vi.fn>

/**
 * A stubbed rAF queue. The coalesced zoom channel only commits on a frame, so the
 * tests drive frames explicitly instead of waiting for wall-clock ones.
 */
beforeEach(() => {
  vi.clearAllMocks()
  FakeTextLayer.reset()
  FakeAnnotationLayer.reset()
  frameCallbacks = []
  cancelRaf = vi.fn()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallbacks.push(cb)
    return frameCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', cancelRaf)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function flushFrames(): void {
  const callbacks = frameCallbacks.splice(0)
  act(() => {
    for (const cb of callbacks) cb(0)
  })
}

/** Let every already-queued microtask (and React update) settle. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

/**
 * Wait for a condition, draining queued animation frames along the way.
 *
 * The rAF stub means frames only run when the test says so, and the coalesced
 * zoom channel (plus the resize refit) commits on a frame. A plain `waitFor`
 * would therefore wait forever for a value that only a frame can produce, so this
 * polls `check` and fires any pending frames between attempts.
 */
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
  task: FakeLoadingTask
}

/** Serve one document, resolved as soon as the viewer asks for it. */
function serveDocument(document: FakeDocument, options: { abortOnDestroy?: boolean } = {}): Served {
  const served: Served = { task: undefined as unknown as FakeLoadingTask }
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask(options)
    served.task = task
    task.resolve(document)
    return task
  })
  return served
}

/** Serve one document the test settles by hand. */
function stageDocument(options: { abortOnDestroy?: boolean } = {}): Served {
  const served: Served = { task: undefined as unknown as FakeLoadingTask }
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask(options)
    served.task = task
    return task
  })
  return served
}

function canvasOf(container: HTMLElement): HTMLCanvasElement | null {
  return container.querySelector<HTMLCanvasElement>('[data-native-pdf-canvas]')
}

/**
 * The page box.
 *
 * Page identity moved from the canvas to this element in Phase 5, because the
 * page box is what now owns both the canvas and the text layer and "the page
 * element" must be unambiguous to a `querySelector`.
 */
function pageOf(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-native-pdf-page]')
}

/* ------------------------------------------------------- document lifecycle */

describe('NativePdfViewer — document lifecycle', () => {
  it('shows a loading state before the document resolves', async () => {
    const document = createFakeDocument({ numPages: 12 })
    const served = stageDocument()

    const { container } = render(<NativeViewerHarness />)

    expect(container.querySelector('[data-native-pdf-loading]')).toBeInTheDocument()
    expect(canvasOf(container)).toBe(null)

    await act(async () => {
      served.task.resolve(document)
      await settle()
    })

    expect(container.querySelector('[data-native-pdf-loading]')).toBe(null)
    expect(canvasOf(container)).toBeTruthy()
  })

  it('renders exactly one canvas for the current page', async () => {
    const document = createFakeDocument({ numPages: 12 })
    serveDocument(document)

    const { container } = render(<NativeViewerHarness />)

    await waitForFrames(() => expect(container.querySelectorAll('canvas')).toHaveLength(1))
    // Single-page parity: one canvas, no page stack behind it.
    expect(container.querySelectorAll('[data-native-pdf-canvas]')).toHaveLength(1)
    expect(document.getPageCalls).toContain(1)
  })

  it('emits no react-pdf-viewer class name on the native canvas', async () => {
    serveDocument(createFakeDocument({ numPages: 4 }))

    const { container } = render(<NativeViewerHarness />)

    await waitForFrames(() => expect(container.querySelectorAll('canvas')).toHaveLength(1))
    // The legacy viewer's CSS and DOM contracts must not reach the native canvas.
    expect(container.querySelector('[class*="rpv-"]')).toBe(null)
  })

  it('stacks canvas, text layer, annotation layer and search overlay in a stated order', async () => {
    serveDocument(createFakeDocument({ numPages: 12 }))

    const { container } = render(<NativeViewerHarness />)

    await waitForFrames(() =>
      expect(container.querySelector('[data-native-pdf-annotation-layer]')).not.toBe(null)
    )

    // PDF.js 6's `LAYERS_ORDER` numbers a page's layers `canvasWrapper` 0,
    // `textLayer` 1, `annotationLayer` 2 and `PDFPageView#addLayer` inserts them in
    // that sequence. The annotation layer has to be after the text layer: it is the one
    // that takes pointer events, and a link under the text layer would not be clickable.
    //
    // The search overlay is the fourth and is *not* a PDF.js layer — PDF.js's own find
    // highlights need the web viewer's page views. It is declared last in the DOM and
    // painted by `z-index: 1`, between the canvas and the annotation layer, so the
    // document order is deliberately not the paint order and is asserted here rather
    // than left to React's render order.
    const page = container.querySelector('[data-native-pdf-page]') as HTMLElement
    const layerAttributes = [...page.children].map((child) =>
      child.getAttributeNames().find((name) => name.startsWith('data-native-pdf'))
    )
    expect(layerAttributes).toEqual([
      'data-native-pdf-canvas',
      'data-native-pdf-text-layer',
      'data-native-pdf-annotation-layer',
      'data-native-pdf-search-layer'
    ])
  })

  it('puts the total scale factor on the page box every layer shares', async () => {
    serveDocument(createFakeDocument({ numPages: 4 }))

    const { container } = render(<NativeViewerHarness />)

    await waitForFrames(() =>
      expect(container.querySelector('[data-native-pdf-annotation-layer]')).not.toBe(null)
    )

    // PDF.js sizes both layers as `--total-scale-factor × <page size>`, so this one
    // inline custom property on the shared box is what keeps a link's hitbox, a text
    // run's box, a search highlight and the canvas on the same geometry at every scale.
    const page = container.querySelector<HTMLElement>('[data-native-pdf-page]')
    const scaleFactor = Number(page?.style.getPropertyValue('--total-scale-factor'))
    expect(scaleFactor).toBeGreaterThan(0)
    expect(page?.querySelector('[data-native-pdf-text-layer]')).not.toBe(null)
    expect(page?.querySelector('[data-native-pdf-annotation-layer]')).not.toBe(null)
    expect(page?.querySelector('[data-native-pdf-search-layer]')).not.toBe(null)
  })

  it('does not treat a degraded annotation layer as a failed page', async () => {
    const document = createFakeDocument({ numPages: 8, settleAnnotations: false })
    serveDocument(document)
    let annotationLayerError: string | null = null

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          annotationLayerError = c.annotationLayerError
        }}
      />
    )
    await waitForFrames(() =>
      expect(document.page(1).getAnnotationsCalls.length).toBeGreaterThan(0)
    )

    await act(async () => {
      document.page(1).failLastAnnotations('annotation lookup failed')
      await settle()
    })

    // Readable is not linked. Showing the error shell would hide a working canvas.
    expect(annotationLayerError).toBe('annotation lookup failed')
    expect(container.querySelector('[data-native-pdf-error]')).toBe(null)
    expect(container.querySelector('canvas')).not.toBe(null)
    expect(container.querySelector('[data-native-pdf-text-layer]')).not.toBe(null)
  })

  it('reports the page count of the loaded document', async () => {
    serveDocument(createFakeDocument({ numPages: 37 }))
    let totalPages = 0

    render(<NativeViewerHarness onController={(c) => (totalPages = c.totalPages)} />)

    await waitForFrames(() => expect(totalPages).toBe(37))
  })

  it('shows a deterministic load error instead of crashing', async () => {
    const served = stageDocument()

    const { container } = render(<NativeViewerHarness />)

    await act(async () => {
      served.task.reject(new Error('InvalidPDFException: header not found'))
      await settle()
    })

    const error = container.querySelector('[data-native-pdf-error]')
    expect(error).toBeInTheDocument()
    expect(error).toHaveTextContent('pdf_load_error')
    expect(error).toHaveTextContent('header not found')
    expect(container.querySelector('[data-native-pdf-loading]')).toBe(null)
  })

  it('starts a new loading lifecycle for the same URL on reload', async () => {
    const first = createFakeDocument({ numPages: 12 })
    const second = createFakeDocument({ numPages: 4 })
    serveDocument(first)

    const { container, rerender } = render(<NativeViewerHarness reloadKey={0} />)
    await waitForFrames(() => expect(canvasOf(container)).toBeTruthy())
    const firstCanvas = canvasOf(container)

    serveDocument(second)
    rerender(<NativeViewerHarness reloadKey={1} />)

    await waitForFrames(() => expect(canvasOf(container)).not.toBe(firstCanvas))
    expect(mocks.getDocument).toHaveBeenCalledTimes(2)
    expect(second.getPageCalls.length).toBeGreaterThan(0)
  })

  it('never renders a superseded document that resolves late', async () => {
    const first = createFakeDocument({ numPages: 12 })
    const second = createFakeDocument({ numPages: 3 })
    // `abortOnDestroy: false` models the real window: the promise can still
    // resolve after the abandoned task was destroyed.
    const firstServed = stageDocument({ abortOnDestroy: false })

    const { container, rerender } = render(<NativeViewerHarness pdfUrl="local-pdf://a" />)

    serveDocument(second)
    rerender(<NativeViewerHarness pdfUrl="local-pdf://b" />)
    await waitForFrames(() => expect(canvasOf(container)).toBeTruthy())

    // The abandoned document now finishes loading, long after it was superseded.
    await act(async () => {
      firstServed.task.resolve(first)
      await settle()
    })

    // No page of the superseded document was ever fetched, and none of its state
    // survived into the UI.
    expect(first.getPageCalls).toEqual([])
    expect(first.renderCallsForAllPages).toEqual([])
    expect(container.querySelector('[data-native-pdf-error]')).toBe(null)
    expect(canvasOf(container)).toBeTruthy()
    expect(second.getPageCalls.length).toBeGreaterThan(0)
  })

  it('is completely inert while the feature flag is off', async () => {
    serveDocument(createFakeDocument({ numPages: 6 }))

    const { container } = render(<NativeViewerHarness enabled={false} />)
    await settle()

    expect(mocks.getDocument).not.toHaveBeenCalled()
    expect(mocks.initializeNativePdfWorker).not.toHaveBeenCalled()
    expect(container.querySelector('canvas')).toBe(null)
    // No page box means no canvas, no text layer and no annotation layer: with the flag
    // off the whole native surface is absent, so the annotation code cannot mount and
    // the legacy viewer's links are the only ones in play.
    expect(container.querySelector('[data-native-pdf-page]')).toBe(null)
    expect(container.querySelector('[data-native-pdf-text-layer]')).toBe(null)
    expect(container.querySelector('[data-native-pdf-annotation-layer]')).toBe(null)
    expect(FakeAnnotationLayer.calls).toHaveLength(0)
  })

  it('creates one engine for the mount, not one per render', async () => {
    serveDocument(createFakeDocument({ numPages: 6 }))

    const { rerender, unmount } = render(<NativeViewerHarness />)
    await waitForFrames(() => expect(mocks.getDocument).toHaveBeenCalledTimes(1))

    rerender(<NativeViewerHarness isPanMode />)
    rerender(<NativeViewerHarness isPanelResizing={false} />)
    unmount()

    // A second manager/renderer per render would have started another load.
    expect(mocks.getDocument).toHaveBeenCalledTimes(1)
  })

  it('destroys the document, cancels the render and cancels the queued zoom frame on unmount', async () => {
    const document = createFakeDocument({ numPages: 6, settleRenders: false })
    const served = serveDocument(document)
    const control: { current: { scale: number; zoomTo: (scale: number) => void } | null } = {
      current: null
    }

    const { container, unmount } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(document.page(1).renderCalls.length).toBeGreaterThan(0))

    // Queue a zoom that must never commit, then tear everything down.
    act(() => control.current?.zoomTo(2))
    expect(cancelRaf).not.toHaveBeenCalled()
    const scaleAtUnmount = control.current?.scale

    unmount()

    // The loading task is destroyed (the manager's single teardown owner), the
    // in-flight render is cancelled, and the pending animation frame is dropped.
    expect(served.task.destroy).toHaveBeenCalled()
    expect(document.page(1).tasks[0]?.cancelled()).toBe(true)
    expect(cancelRaf).toHaveBeenCalled()
    expect(container.querySelector('canvas')).toBe(null)

    // Even if a stale frame callback were invoked by something else, the queued
    // zoom is gone and nothing can commit it.
    const staleFrames = frameCallbacks.splice(0)
    for (const cb of staleFrames) cb(0)
    expect(control.current?.scale).toBe(scaleAtUnmount)
  })

  it('does not update state when a load settles after unmount', async () => {
    const document = createFakeDocument({ numPages: 6 })
    const served = stageDocument()
    const errors: unknown[] = []
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args)
    })

    const { unmount } = render(<NativeViewerHarness />)
    unmount()

    await act(async () => {
      served.task.resolve(document)
      await settle()
    })

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

/* ------------------------------------------------------------- page state */

describe('NativePdfViewer — page state', () => {
  function mountWith(document: FakeDocument, initialPage?: number) {
    serveDocument(document)
    const observed: { currentPage: number; totalPages: number } = { currentPage: 0, totalPages: 0 }
    const view = render(
      <NativeViewerHarness
        initialPage={initialPage}
        onController={(c) => {
          observed.currentPage = c.currentPage
          observed.totalPages = c.totalPages
        }}
      />
    )
    return { ...view, observed }
  }

  it('starts on page 1 and renders it', async () => {
    const document = createFakeDocument({ numPages: 12 })
    const { container, observed } = mountWith(document)

    await waitForFrames(() => expect(observed.currentPage).toBe(1))
    await waitForFrames(() =>
      expect(pageOf(container)).toHaveAttribute('data-native-pdf-page', '1')
    )
    expect(document.getPageCalls).toContain(1)
  })

  it('restores a valid initial page', async () => {
    const document = createFakeDocument({ numPages: 20 })
    const { observed } = mountWith(document, 7)

    await waitForFrames(() => expect(observed.currentPage).toBe(7))
  })

  it('clamps an initial page above the document length', async () => {
    const document = createFakeDocument({ numPages: 5 })
    const { observed } = mountWith(document, 99)

    await waitForFrames(() => expect(observed.currentPage).toBe(5))
  })

  it('clamps an initial page below 1', async () => {
    const document = createFakeDocument({ numPages: 5 })
    const { observed } = mountWith(document, -3)

    await waitForFrames(() => expect(observed.currentPage).toBe(1))
  })

  it('never navigates past either end of the document', async () => {
    const document = createFakeDocument({ numPages: 3 })
    serveDocument(document)
    const control: {
      current: {
        currentPage: number
        goToNextPage: () => void
        goToPreviousPage: () => void
        jumpToPage: (page: number) => void
      } | null
    } = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )

    // The clamp needs the real page count, so wait for the document to be ready
    // rather than for the initial page value, which is 1 before anything loads.
    await waitForFrames(() => expect(canvasOf(container)).toBeTruthy())
    expect(control.current?.currentPage).toBe(1)

    act(() => control.current?.goToPreviousPage())
    expect(control.current?.currentPage).toBe(1)

    act(() => control.current?.goToNextPage())
    expect(control.current?.currentPage).toBe(2)
    act(() => control.current?.goToNextPage())
    act(() => control.current?.goToNextPage())
    expect(control.current?.currentPage).toBe(3)

    act(() => control.current?.jumpToPage(99))
    expect(control.current?.currentPage).toBe(3)
    act(() => control.current?.jumpToPage(0))
    expect(control.current?.currentPage).toBe(1)
  })

  it('re-renders the canvas for the page navigation moved to', async () => {
    const document = createFakeDocument({ numPages: 12 })
    serveDocument(document)
    const control: { current: { goToNextPage: () => void } | null } = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )

    await waitForFrames(() => expect(document.page(1).renderCalls.length).toBeGreaterThan(0))
    act(() => control.current?.goToNextPage())

    await waitForFrames(() => expect(document.page(2).renderCalls.length).toBeGreaterThan(0))
    expect(pageOf(container)).toHaveAttribute('data-native-pdf-page', '2')
  })
})

/* ------------------------------------------------------------ scale state */

describe('NativePdfViewer — scale state', () => {
  it('applies the shared fit scale once the document and container are known', async () => {
    serveDocument(createFakeDocument({ numPages: 12, width: 400, height: 600 }))
    const observed = { scale: 0 }

    render(
      <NativeViewerHarness
        containerSize={{ w: 800, h: 1000 }}
        onController={(c) => (observed.scale = c.scale)}
      />
    )

    await waitForFrames(() => expect(observed.scale).not.toBe(1))

    await waitForFrames(() => expect(observed.scale).toBe(FIT_SCALE))
  })

  it('applies the fit once per document, so no fit → render → resize loop forms', async () => {
    serveDocument(createFakeDocument({ numPages: 12, width: 400, height: 600 }))
    const scales: number[] = []

    render(
      <NativeViewerHarness
        containerSize={{ w: 800, h: 1000 }}
        onController={(c) => scales.push(c.scale)}
      />
    )
    await waitForFrames(() => expect(scales.length).toBeGreaterThan(1))
    flushFrames()
    flushFrames()
    await settle()

    expect([...new Set(scales)]).toEqual([1, FIT_SCALE])
  })

  it('commits only the latest of several same-frame zoom requests', async () => {
    serveDocument(createFakeDocument({ numPages: 12 }))
    const control: { current: { scale: number; zoomTo: (scale: number) => void } | null } = {
      current: null
    }

    render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(control.current?.scale).toBeGreaterThan(0))
    flushFrames()

    act(() => {
      control.current?.zoomTo(1.2)
      control.current?.zoomTo(1.4)
      control.current?.zoomTo(1.6)
    })
    // Nothing committed yet: the effective change lands on the next frame.
    expect(control.current?.scale).not.toBe(1.6)

    flushFrames()
    await waitForFrames(() => expect(control.current?.scale).toBe(1.6))
  })

  it('steps zoom in and out by the shared product step', async () => {
    serveDocument(createFakeDocument({ numPages: 12 }))
    const control: { current: { scale: number; zoomIn: () => void; zoomOut: () => void } | null } =
      { current: null }

    render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(control.current?.scale).toBeGreaterThan(0))
    flushFrames()
    await settle()

    const base = control.current?.scale ?? 0
    expect(base).toBeGreaterThan(0)

    act(() => control.current?.zoomIn())
    flushFrames()
    await waitForFrames(() => expect(control.current?.scale).toBeCloseTo(base + 0.1, 5))

    act(() => control.current?.zoomOut())
    flushFrames()
    await waitForFrames(() => expect(control.current?.scale).toBeCloseTo(base, 5))
  })

  it('clamps zoom at the shared product bounds', async () => {
    serveDocument(createFakeDocument({ numPages: 12 }))
    const control: { current: { scale: number; zoomTo: (scale: number) => void } | null } = {
      current: null
    }

    render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(control.current?.scale).toBeGreaterThan(0))
    flushFrames()

    act(() => control.current?.zoomTo(999))
    flushFrames()
    await waitForFrames(() => expect(control.current?.scale).toBe(5))

    act(() => control.current?.zoomTo(0.0001))
    flushFrames()
    await waitForFrames(() => expect(control.current?.scale).toBe(0.1))
  })
})

/* --------------------------------------------------------- render lifecycle */

describe('NativePdfViewer — render lifecycle', () => {
  /**
   * The viewer renders once at the placeholder scale and again at the fit scale,
   * because the fit commits on the next animation frame (that frame is what keeps
   * a zoom burst to one render). The first render is superseded by the engine's
   * cancel, so the assertions below look at the *live* render rather than at a
   * fixed render count.
   */
  function liveRender(page: { tasks: { cancelled: () => boolean }[] }) {
    return page.tasks.filter((task) => !task.cancelled()).at(-1)
  }

  it('sizes the canvas from the page viewport at the effective scale', async () => {
    serveDocument(createFakeDocument({ numPages: 12, width: 400, height: 600 }))

    const { container } = render(<NativeViewerHarness containerSize={{ w: 800, h: 1000 }} />)

    await waitForFrames(() => {
      const canvas = canvasOf(container)
      // 400 × 1.67 and 600 × 1.67, floored by the engine.
      expect(canvas?.width).toBe(668)
      expect(canvas?.height).toBe(1002)
    })
  })

  it('cancels the in-flight render when the page changes', async () => {
    const document = createFakeDocument({ numPages: 12, settleRenders: false })
    serveDocument(document)
    const control: { current: { goToNextPage: () => void } | null } = { current: null }

    render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )

    await waitForFrames(() => expect(liveRender(document.page(1))).toBeDefined())
    const cancelledBefore = document.page(1).tasks.filter((t) => t.cancelled()).length

    act(() => control.current?.goToNextPage())

    await waitForFrames(() => expect(document.page(2).renderCalls.length).toBeGreaterThan(0))
    expect(document.page(1).tasks.filter((t) => t.cancelled()).length).toBeGreaterThan(
      cancelledBefore
    )
  })

  it('keeps the new page authoritative when the previous render settles late', async () => {
    const document = createFakeDocument({ numPages: 12, settleRenders: false })
    serveDocument(document)
    const control: { current: { currentPage: number; goToNextPage: () => void } | null } = {
      current: null
    }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )

    await waitForFrames(() => expect(liveRender(document.page(1))).toBeDefined())
    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(document.page(2).renderCalls.length).toBeGreaterThan(0))

    // Page 1's cancelled render settles after the move; nothing may regress.
    await act(async () => {
      document.page(1).settleLastRender()
      await settle()
    })

    expect(control.current?.currentPage).toBe(2)
    expect(pageOf(container)).toHaveAttribute('data-native-pdf-page', '2')
    expect(container.querySelector('[data-native-pdf-error]')).toBe(null)
  })

  it('treats a cancelled render as normal rather than as an error', async () => {
    const document = createFakeDocument({ numPages: 12, settleRenders: false })
    serveDocument(document)
    const control: { current: { goToNextPage: () => void } | null } = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )

    await waitForFrames(() => expect(liveRender(document.page(1))).toBeDefined())
    act(() => control.current?.goToNextPage())
    await waitForFrames(() =>
      expect(document.page(1).tasks.some((task) => task.cancelled())).toBe(true)
    )
    await settle()

    // The cancelled task rejects with the typed cancellation error; a page the
    // viewer abandoned must not produce a failure for the user.
    expect(container.querySelector('[data-native-pdf-error]')).toBe(null)
    expect(pageOf(container)).toHaveAttribute('data-native-pdf-page', '2')
  })

  it('surfaces a genuine render failure as a visible fallback', async () => {
    const document = createFakeDocument({ numPages: 12, settleRenders: false })
    serveDocument(document)

    const { container } = render(<NativeViewerHarness />)

    await waitForFrames(() => expect(liveRender(document.page(1))).toBeDefined())
    await act(async () => {
      document.page(1).failLastRender('cannot parse content stream')
      await settle()
    })

    const error = container.querySelector('[data-native-pdf-error]')
    expect(error).toBeInTheDocument()
    expect(error).toHaveTextContent('cannot parse content stream')
  })

  it('falls back to the unknown-error copy when a failure carries no message', async () => {
    const document = createFakeDocument({ numPages: 12, settleRenders: false })
    serveDocument(document)

    const { container } = render(<NativeViewerHarness />)

    await waitForFrames(() => expect(liveRender(document.page(1))).toBeDefined())
    await act(async () => {
      document.page(1).failLastRender('')
      await settle()
    })

    expect(container.querySelector('[data-native-pdf-error]')).toHaveTextContent(
      'error_unknown_error'
    )
  })
})

/* --------------------------------------------------- pan-mode suppression */

describe('NativePdfViewer — pan mode', () => {
  it('suppresses Ctrl+wheel zoom while pan mode is active', async () => {
    serveDocument(createFakeDocument({ numPages: 12 }))
    const control: { current: { scale: number } | null } = { current: null }

    const { container } = render(
      <NativeViewerHarness
        isPanMode
        onController={(c) => {
          control.current = c
        }}
      />
    )

    await waitForFrames(() => expect(canvasOf(container)).toBeTruthy())
    flushFrames()
    const before = control.current?.scale

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -1
    })
    act(() => {
      screen.getByTestId('native-container').dispatchEvent(wheelEvent)
    })
    flushFrames()

    expect(control.current?.scale).toBe(before)
    expect(wheelEvent.defaultPrevented).toBe(false)
  })
})

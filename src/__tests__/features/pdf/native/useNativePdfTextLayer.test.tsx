/**
 * The native text layer's lifecycle.
 *
 * The real engine (`documentManager`, `pageCache`, `pageRenderer`) and the real
 * `useNativePdfTextLayer` run here; only the `pdfjs-6` boundary is faked, and the
 * `TextLayer` double is faithful where it matters — it appends PDF.js's own
 * `span[role="presentation"]` markup to the container it was handed, and
 * `cancel()` rejects the in-flight `render()` with an `AbortException`.
 *
 * What is pinned:
 *
 *  - one text layer, holding the current page, named in the DOM
 *  - the layer is built from the *same* viewport scale the canvas renderer used
 *  - a page change, a zoom, a document switch and unmount each supersede the
 *    previous layer through the real PDF.js cancellation path
 *  - a superseded lookup cannot write text into the live page, and cannot publish
 *    state either
 *  - one `getTextContent()` per page for the life of the document
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

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn()
}))

vi.mock('pdfjs-6', async () => {
  // Lazy: a `vi.mock` factory is hoisted above this file's static imports, and
  // the double has to be a dependency-free module so awaiting it cannot re-enter
  // the mocked module.
  const { FakeAnnotationLayer } = await import('./nativeAnnotationLayerDouble')
  const { FakeTextLayer: Double } = await import('./nativeTextLayerDouble')
  return {
    getDocument: mocks.getDocument,
    TextLayer: Double,
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

let frameCallbacks: FrameRequestCallback[]

beforeEach(() => {
  vi.clearAllMocks()
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

function serveDocument(document: FakeDocument, options: { abortOnDestroy?: boolean } = {}) {
  const served: { task: FakeLoadingTask } = { task: undefined as unknown as FakeLoadingTask }
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask(options)
    served.task = task
    task.resolve(document)
    return task
  })
  return served
}

function stageDocument(options: { abortOnDestroy?: boolean } = {}) {
  const served: { task: FakeLoadingTask } = { task: undefined as unknown as FakeLoadingTask }
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask(options)
    served.task = task
    return task
  })
  return served
}

function textLayerOf(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-native-pdf-text-layer]')
}

function pageOf(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-native-pdf-page]')
}

/** The text the layer actually rendered, in DOM order. */
function renderedText(container: HTMLElement): string {
  return textLayerOf(container)?.textContent ?? ''
}

interface Control {
  current: {
    currentPage: number
    scale: number
    goToNextPage: () => void
    zoomTo: (scale: number) => void
    textLayerError: string | null
  } | null
}

/* ------------------------------------------------------------ mount + shape */

describe('native text layer — mount and shape', () => {
  it('mounts one text layer for the current page, inside the page box', async () => {
    serveDocument(createFakeDocument({ numPages: 12, textItems: { 1: ['hello', 'world'] } }))

    const { container } = render(<NativeViewerHarness />)

    await waitForFrames(() => expect(renderedText(container)).toBe('helloworld'))

    const layer = textLayerOf(container)
    expect(container.querySelectorAll('[data-native-pdf-text-layer]')).toHaveLength(1)
    // The layer is a sibling of the canvas inside one page box, which is what
    // makes canvas and text share a positioning box.
    expect(pageOf(container)).toContainElement(layer as HTMLElement)
    expect(layer).toHaveAttribute('data-native-pdf-text-page', '1')
    expect(pageOf(container)).toHaveAttribute('data-native-pdf-page', '1')
    // PDF.js's own text-run markup, not something re-derived.
    expect(layer?.querySelectorAll('span[role="presentation"]')).toHaveLength(2)
  })

  it('never leaves a second text layer or a stale page box behind', async () => {
    serveDocument(createFakeDocument({ numPages: 12, textItems: { 1: ['one'], 2: ['two'] } }))
    const control: Control = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(renderedText(container)).toBe('one'))

    act(() => control.current?.goToNextPage())

    await waitForFrames(() => expect(renderedText(container)).toBe('two'))
    expect(container.querySelectorAll('[data-native-pdf-page]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-native-pdf-text-layer]')).toHaveLength(1)
    expect(container.querySelectorAll('canvas')).toHaveLength(1)
    // The superseded page's runs are gone, not merely hidden.
    expect(textLayerOf(container)?.textContent).not.toContain('one')
  })

  it('builds the layer from the same viewport scale the canvas was rendered at', async () => {
    serveDocument(createFakeDocument({ numPages: 12, width: 400, height: 600 }))

    const { container } = render(<NativeViewerHarness containerSize={{ w: 800, h: 1000 }} />)

    await waitForFrames(() => expect(FakeTextLayer.calls.length).toBeGreaterThan(0))

    const liveCall = FakeTextLayer.calls.at(-1)
    const liveRender = container.querySelector('canvas') as HTMLCanvasElement
    // 400 × 1.67 and 600 × 1.67 — the identical viewport the canvas used.
    expect(liveCall?.scale).toBeCloseTo(1.67, 5)
    expect(liveCall?.width).toBeCloseTo(liveRender.width, 5)
    expect(liveCall?.height).toBeCloseTo(liveRender.height, 5)
  })

  it('passes a rotated viewport through instead of assuming a 0° page', async () => {
    serveDocument(createFakeDocument({ numPages: 4, width: 400, height: 600, rotation: 90 }))

    const { container } = render(<NativeViewerHarness />)

    await waitForFrames(() => expect(FakeTextLayer.calls.length).toBeGreaterThan(0))
    const call = FakeTextLayer.calls.at(-1)

    // A 90° page swaps the axes: the layer must be laid out against the rotated
    // box, or every selection highlight would sit off the glyphs.
    expect(call?.rotation).toBe(90)
    expect(call?.width).toBeCloseTo((600 as number) * (call?.scale as number), 5)
    expect(call?.height).toBeCloseTo((400 as number) * (call?.scale as number), 5)
    expect(container.querySelector('canvas')?.width).toBe(Math.floor(call?.width as number))
  })

  it('asks for the page text once and reuses it across zooms', async () => {
    serveDocument(createFakeDocument({ numPages: 12, textItems: { 1: ['cached'] } }))
    const control: Control = { current: null }

    render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(FakeTextLayer.calls.length).toBeGreaterThan(0))

    act(() => control.current?.zoomTo(2))
    flushFrames()
    await waitForFrames(() => expect(FakeTextLayer.calls.at(-1)?.scale).toBe(2))
    act(() => control.current?.zoomTo(3))
    flushFrames()
    await waitForFrames(() => expect(FakeTextLayer.calls.at(-1)?.scale).toBe(3))

    // Three layers, one lookup: a zoom changes the scale, not the text.
    expect(FakeTextLayer.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('is inert while the feature flag is off', async () => {
    serveDocument(createFakeDocument({ numPages: 6 }))

    const { container } = render(<NativeViewerHarness enabled={false} />)
    await settle()

    expect(mocks.getDocument).not.toHaveBeenCalled()
    expect(FakeTextLayer.calls).toHaveLength(0)
    expect(textLayerOf(container)).toBe(null)
  })
})

/* ------------------------------------------------------------- supersede */

describe('native text layer — supersede and cleanup', () => {
  it('replaces the layer on a page change and cancels the previous one', async () => {
    serveDocument(createFakeDocument({ numPages: 12, textItems: { 1: ['one'], 2: ['two'] } }))
    const control: Control = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(renderedText(container)).toBe('one'))
    const firstLayer = FakeTextLayer.instances.at(-1)

    act(() => control.current?.goToNextPage())

    await waitForFrames(() => expect(renderedText(container)).toBe('two'))
    expect(firstLayer?.isCancelled()).toBe(true)
    expect(FakeTextLayer.instances.at(-1)).not.toBe(firstLayer)
    expect(textLayerOf(container)).toHaveAttribute('data-native-pdf-text-page', '2')
  })

  it('rebuilds at the latest scale when a zoom burst supersedes itself', async () => {
    serveDocument(createFakeDocument({ numPages: 12, textItems: { 1: ['one'] } }))
    const control: Control = { current: null }

    render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(FakeTextLayer.calls.length).toBeGreaterThan(0))
    const stale = FakeTextLayer.instances.at(-1)

    act(() => {
      control.current?.zoomTo(2)
      control.current?.zoomTo(3)
      control.current?.zoomTo(4)
    })
    flushFrames()

    await waitForFrames(() => expect(FakeTextLayer.calls.at(-1)?.scale).toBe(4))
    // The abandoned layers were cancelled through PDF.js, not left resolving.
    expect(stale?.isCancelled()).toBe(true)
    expect(FakeTextLayer.calls.every((call) => call.scale <= 4)).toBe(true)
    expect(FakeTextLayer.calls.at(-1)?.scale).toBe(4)
  })

  it('cancels the in-flight layer and empties the DOM on unmount', async () => {
    const document = createFakeDocument({ numPages: 6, settleTextContent: false })
    serveDocument(document)

    const { container, unmount } = render(<NativeViewerHarness />)
    await waitForFrames(() =>
      expect(document.page(1).getTextContentCalls.length).toBeGreaterThan(0)
    )

    const errors: unknown[] = []
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args)
    })

    unmount()

    expect(FakeTextLayer.instances.every((layer) => layer.isCancelled())).toBe(true)
    expect(textLayerOf(container)).toBe(null)

    // The pending lookup settles after teardown: nothing may publish afterwards.
    await act(async () => {
      document.page(1).settleLastTextContent()
      await settle()
    })
    expect(consoleError).not.toHaveBeenCalled()
    expect(FakeTextLayer.calls).toHaveLength(0)
    consoleError.mockRestore()
  })

  it('reports a cancelled layer as normal rather than as an error', async () => {
    serveDocument(createFakeDocument({ numPages: 12, textItems: { 1: ['one'], 2: ['two'] } }))
    // Hold the render open so the zoom below supersedes an in-flight layer and
    // PDF.js's own `cancel()` → `render()` rejection is what the hook has to drop.
    FakeTextLayer.autoResolve = false
    const control: Control = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(FakeTextLayer.instances.length).toBeGreaterThan(0))
    const held = FakeTextLayer.instances.at(-1)
    expect(held?.isCancelled()).toBe(false)

    act(() => control.current?.zoomTo(2))
    flushFrames()
    await settle()

    expect(held?.isCancelled()).toBe(true)
    // A cancelled layer is not a failure: no error state, no console noise.
    expect(control.current?.textLayerError).toBe(null)
    expect(container.querySelector('[data-native-pdf-error]')).toBe(null)
  })

  it('surfaces a genuine text-layer failure instead of failing silently', async () => {
    const document = createFakeDocument({ numPages: 12, settleTextContent: false })
    serveDocument(document)
    const control: Control = { current: null }

    render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() =>
      expect(document.page(1).getTextContentCalls.length).toBeGreaterThan(0)
    )

    await act(async () => {
      document.page(1).failLastTextContent('text extraction failed')
      await settle()
    })

    expect(control.current?.textLayerError).toBe('text extraction failed')
  })
})

/* ------------------------------------------------------------------ races */

describe('native text layer — races', () => {
  it('never lets a superseded document write text into the new page', async () => {
    const first = createFakeDocument({ numPages: 12, settleTextContent: false })
    const second = createFakeDocument({ numPages: 3, textItems: { 1: ['second document'] } })
    stageDocument({ abortOnDestroy: false })

    const { container, rerender } = render(<NativeViewerHarness pdfUrl="local-pdf://a" />)

    serveDocument(second)
    rerender(<NativeViewerHarness pdfUrl="local-pdf://b" />)
    await waitForFrames(() => expect(renderedText(container)).toBe('second document'))

    // The abandoned document's text lookup finishes long after it was superseded.
    await act(async () => {
      first.page(1).settleLastTextContent()
      await settle()
    })

    expect(renderedText(container)).toBe('second document')
    expect(textLayerOf(container)).toHaveAttribute('data-native-pdf-text-page', '1')
  })

  it('keeps the new page authoritative when the previous page settles late', async () => {
    const document = createFakeDocument({
      numPages: 12,
      settleTextContent: false,
      textItems: { 2: ['page two text'] }
    })
    serveDocument(document)
    const control: Control = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() =>
      expect(document.page(1).getTextContentCalls.length).toBeGreaterThan(0)
    )

    act(() => control.current?.goToNextPage())
    await waitForFrames(() =>
      expect(document.page(2).getTextContentCalls.length).toBeGreaterThan(0)
    )

    // Page 1's lookup lands after the move and must not resurrect page 1's layer.
    await act(async () => {
      document.page(1).settleLastTextContent()
      await settle()
    })
    document.page(2).settleLastTextContent()

    await waitForFrames(() => expect(renderedText(container)).toBe('page two text'))
    expect(textLayerOf(container)).toHaveAttribute('data-native-pdf-text-page', '2')
  })

  it('renders the page text once, not twice, when a zoom supersedes a pending lookup', async () => {
    const document = createFakeDocument({
      numPages: 12,
      settleTextContent: false,
      textItems: { 1: ['slow', 'page'] }
    })
    serveDocument(document)
    const control: Control = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() =>
      expect(document.page(1).getTextContentCalls.length).toBeGreaterThan(0)
    )

    // Zoom before the lookup settles. The new effect reuses the *pending* lookup
    // for the same page, so when it lands exactly one layer is built — at the new
    // scale — and the runs are not appended twice.
    act(() => control.current?.zoomTo(2))
    flushFrames()
    await act(async () => {
      document.page(1).settleLastTextContent()
      await settle()
    })
    await settle()

    expect(renderedText(container)).toBe('slowpage')
    expect(container.querySelectorAll('[data-native-pdf-text-layer]')).toHaveLength(1)
    expect(textLayerOf(container)?.querySelectorAll('span[role="presentation"]')).toHaveLength(2)
    expect(FakeTextLayer.calls).toHaveLength(1)
    expect(FakeTextLayer.calls[0].scale).toBe(2)
  })
})

/**
 * The native annotation layer's lifecycle, and the links PDF.js generates inside it.
 *
 * The real engine, the real `useNativePdfAnnotationLayer` and the real
 * `nativePdfLinkService` run here; only the `pdfjs-6` boundary is faked. The
 * `AnnotationLayer` double reproduces `LinkAnnotationElement.render()` from
 * `build/pdf.mjs` closely enough that a test clicks the anchor PDF.js would have
 * produced — the link service does its own navigation, and the page moves because the
 * controller said so.
 *
 * What is pinned:
 *
 *  - one annotation layer for the current page, named in the DOM, inside the page box
 *  - the same viewport the canvas used, rotation included
 *  - `display` intent, and forms/scripting off
 *  - a page change, a zoom, a document switch, a reload and unmount each supersede the
 *    previous layer, and a superseded lookup cannot write into the live page
 *  - one canvas, one text layer, one annotation layer, always
 *  - clicking an internal link moves `currentPage`; an external one opens through the
 *    app's pathway; an unsafe one cannot
 *  - a document with no annotations is not an error
 */
import {
  type FakeDocument,
  type FakeLoadingTask,
  NativeViewerHarness,
  createFakeDocument,
  createLoadingTask
} from './nativeViewerHarness'
import { FakeAnnotationLayer, type FakeAnnotation } from './nativeAnnotationLayerDouble'
import { FakeTextLayer } from './nativeTextLayerDouble'

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn(),
  openExternal: vi.fn()
}))

vi.mock('pdfjs-6', async () => {
  const { FakeAnnotationLayer: AnnotationDouble } = await import('./nativeAnnotationLayerDouble')
  const { FakeTextLayer: TextDouble } = await import('./nativeTextLayerDouble')
  return {
    getDocument: mocks.getDocument,
    TextLayer: TextDouble,
    AnnotationLayer: AnnotationDouble,
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

// The link service's default external pathway. Replaced with a spy so a test can see
// that a URL reached it — and, more importantly, that an unsafe one did not.
vi.mock('@shared/lib/electronApi', () => ({
  // `hasElectronApi` is read by `isMacPlatform()`, which the native controller's
  // zoom-shortcut hook and its `aria-keyshortcuts` values both call. Returning
  // `true` with a non-Darwin `platform` keeps them on the Ctrl branch.
  hasElectronApi: () => true,
  getElectronApi: () => ({ platform: 'win32', openExternal: mocks.openExternal })
}))

let frameCallbacks: FrameRequestCallback[]

/** `AnnotationType.LINK` from `build/pdf.mjs`. */
const LINK = 2

/** One internal `GoTo` destination to the 0-based index `pageIndex`. */
function internalLink(id: string, pageIndex: number, rect = [10, 20, 90, 40]): FakeAnnotation {
  return { id, annotationType: LINK, rect, dest: [pageIndex, { name: 'XYZ' }] }
}

function externalLink(id: string, url: string, newWindow = false): FakeAnnotation {
  return { id, annotationType: LINK, rect: [10, 20, 90, 40], url, newWindow }
}

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

function serveDocument(document: FakeDocument) {
  const served: { task: FakeLoadingTask } = { task: undefined as unknown as FakeLoadingTask }
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask({ abortOnDestroy: false })
    served.task = task
    task.resolve(document)
    return task
  })
  return served
}

function annotationLayerOf(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-native-pdf-annotation-layer]')
}

function pageOf(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-native-pdf-page]')
}

function linkAnchorsOf(container: HTMLElement): HTMLAnchorElement[] {
  return [...(annotationLayerOf(container)?.querySelectorAll('a') ?? [])]
}

interface Control {
  current: {
    currentPage: number
    scale: number
    annotationLayerError: string | null
    textLayerError: string | null
    goToNextPage: () => void
    jumpToPage: (page: number) => void
    zoomTo: (scale: number) => void
  } | null
}

/* ------------------------------------------------------------ mount + shape */

describe('native annotation layer — mount and shape', () => {
  it('mounts one annotation layer for the current page, inside the page box', async () => {
    serveDocument(createFakeDocument({ numPages: 12, annotations: { 1: [internalLink('a', 0)] } }))

    const { container } = render(<NativeViewerHarness />)

    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))

    const layer = annotationLayerOf(container)
    expect(container.querySelectorAll('[data-native-pdf-annotation-layer]')).toHaveLength(1)
    // Sibling of the canvas and the text layer inside one page box: the three share a
    // positioning box and a viewport.
    expect(pageOf(container)).toContainElement(layer as HTMLElement)
    expect(layer).toHaveAttribute('data-native-pdf-annotation-page', '1')
    expect(pageOf(container)).toHaveAttribute('data-native-pdf-page', '1')
  })

  it('builds the layer from the same viewport scale the canvas was rendered at', async () => {
    serveDocument(createFakeDocument({ numPages: 12, width: 400, height: 600 }))

    const { container } = render(<NativeViewerHarness containerSize={{ w: 800, h: 1000 }} />)

    await waitForFrames(() => expect(FakeAnnotationLayer.calls.length).toBeGreaterThan(0))

    const liveCall = FakeAnnotationLayer.calls.at(-1)
    const liveRender = container.querySelector('canvas') as HTMLCanvasElement
    const textCall = FakeTextLayer.calls.at(-1)
    // One scale for canvas, text layer and annotation layer. A link whose hitbox is
    // computed from a different number would be off by the difference.
    expect(liveCall?.scale).toBeCloseTo(1.67, 5)
    expect(liveCall?.width).toBeCloseTo(liveRender.width, 5)
    expect(liveCall?.height).toBeCloseTo(liveRender.height, 5)
    expect(liveCall?.scale).toBeCloseTo(textCall?.scale as number, 5)
  })

  it('passes a rotated viewport through instead of assuming a 0° page', async () => {
    serveDocument(createFakeDocument({ numPages: 4, width: 400, height: 600, rotation: 90 }))

    const { container } = render(<NativeViewerHarness />)

    await waitForFrames(() => expect(FakeAnnotationLayer.calls.length).toBeGreaterThan(0))
    const call = FakeAnnotationLayer.calls.at(-1)

    // A 90° page swaps the axes: an annotation box positioned against the unrotated
    // box would miss the glyphs it belongs to, so the viewport has to come through
    // whole — rotation included.
    expect(call?.rotation).toBe(90)
    expect(call?.width).toBeCloseTo((600 as number) * (call?.scale as number), 5)
    expect(call?.height).toBeCloseTo((400 as number) * (call?.scale as number), 5)
    expect(container.querySelector('canvas')?.width).toBe(Math.floor(call?.width as number))
  })

  it('asks for the display intent, and only the display intent', async () => {
    const document = createFakeDocument({ numPages: 6, annotations: { 1: [internalLink('a', 0)] } })
    serveDocument(document)

    render(<NativeViewerHarness />)
    await waitForFrames(() => expect(FakeAnnotationLayer.calls.length).toBeGreaterThan(0))

    // `display` is what the canvas painted; print-only annotations are not this viewer's
    // business and adding them would put geometry nothing asked for into the layer.
    expect(document.page(1).getAnnotationsCalls.every((c) => c.intent === 'display')).toBe(true)
  })

  it('renders forms off and scripting off, matching the document options', async () => {
    serveDocument(createFakeDocument({ numPages: 6, annotations: { 1: [internalLink('a', 0)] } }))

    render(<NativeViewerHarness />)
    await waitForFrames(() => expect(FakeAnnotationLayer.calls.length).toBeGreaterThan(0))

    const call = FakeAnnotationLayer.calls.at(-1)
    // A widget with a baked-in appearance stays the canvas's painting and cannot be
    // edited; and a JavaScript annotation action is never bound.
    expect(call?.renderForms).toBe(false)
    expect(call?.enableScripting).toBe(false)
    expect(call?.hasJSActions).toBe(false)
  })

  it('leaves exactly one canvas, one text layer and one annotation layer', async () => {
    serveDocument(createFakeDocument({ numPages: 12, annotations: { 1: [internalLink('a', 0)] } }))

    const { container } = render(<NativeViewerHarness />)
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))

    expect(container.querySelectorAll('canvas')).toHaveLength(1)
    expect(container.querySelectorAll('[data-native-pdf-text-layer]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-native-pdf-annotation-layer]')).toHaveLength(1)
  })

  it('handles a document with no annotations at all', async () => {
    serveDocument(createFakeDocument({ numPages: 9 }))

    const control: Control = { current: null }
    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )

    await waitForFrames(() => expect(FakeAnnotationLayer.calls.length).toBeGreaterThan(0))
    await settle()

    // An empty layer, no error, and the two other surfaces still working.
    expect(linkAnchorsOf(container)).toHaveLength(0)
    expect(annotationLayerOf(container)).toHaveAttribute('data-native-pdf-annotation-page', '1')
    expect(control.current?.annotationLayerError).toBe(null)
    expect(container.querySelector('[data-native-pdf-error]')).toBe(null)
    expect(container.querySelector('[data-native-pdf-text-layer]')).not.toBe(null)
    expect(container.querySelector('canvas')).not.toBe(null)
  })

  it('is inert while the feature flag is off', async () => {
    serveDocument(createFakeDocument({ numPages: 6, annotations: { 1: [internalLink('a', 0)] } }))

    const { container } = render(<NativeViewerHarness enabled={false} />)
    await settle()

    expect(mocks.getDocument).not.toHaveBeenCalled()
    expect(FakeAnnotationLayer.calls).toHaveLength(0)
    expect(annotationLayerOf(container)).toBe(null)
  })
})

/* -------------------------------------------------------------- supersede */

describe('native annotation layer — supersede and cleanup', () => {
  it('replaces the layer on a page change and destroys the previous one', async () => {
    serveDocument(
      createFakeDocument({
        numPages: 12,
        annotations: { 1: [internalLink('a', 0)], 2: [internalLink('b', 0)] }
      })
    )
    const control: Control = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))
    const firstLayer = FakeAnnotationLayer.instances.at(-1)

    act(() => control.current?.goToNextPage())

    await waitForFrames(() =>
      expect(annotationLayerOf(container)).toHaveAttribute('data-native-pdf-annotation-page', '2')
    )
    expect(firstLayer?.isDestroyed()).toBe(true)
    expect(FakeAnnotationLayer.instances.at(-1)).not.toBe(firstLayer)
    // The superseded page's link is gone, not merely hidden: an invisible clickable
    // link over the new page is worse than none.
    expect(annotationLayerOf(container)?.querySelector('[data-annotation-id="a"]')).toBeNull()
  })

  it('rebuilds at the latest scale when a zoom burst supersedes itself', async () => {
    serveDocument(createFakeDocument({ numPages: 12, annotations: { 1: [internalLink('a', 0)] } }))
    const control: Control = { current: null }

    render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(FakeAnnotationLayer.calls.length).toBeGreaterThan(0))
    const stale = FakeAnnotationLayer.instances.at(-1)

    act(() => {
      control.current?.zoomTo(2)
      control.current?.zoomTo(3)
      control.current?.zoomTo(4)
    })
    flushFrames()

    await waitForFrames(() => expect(FakeAnnotationLayer.calls.at(-1)?.scale).toBe(4))
    expect(stale?.isDestroyed()).toBe(true)
    // Every hitbox belongs to the latest viewport; no stale layer survives.
    expect(FakeAnnotationLayer.calls.every((call) => call.scale <= 4)).toBe(true)
    expect(FakeAnnotationLayer.calls.at(-1)?.scale).toBe(4)
  })

  it('drops a destination that resolves after a zoom superseded its layer', async () => {
    serveDocument(
      createFakeDocument({
        numPages: 12,
        destinations: { chapterTwo: [2, { name: 'XYZ' }] },
        annotations: { 1: [{ ...internalLink('a', 0), dest: 'chapterTwo' }] }
      })
    )
    const control: Control = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))

    // The click starts a named-destination lookup. The zoom supersedes the layer — and
    // with it the link service that click belonged to — before the lookup lands. The
    // frames are flushed while the stack is still synchronous, so the dispose really
    // does happen first rather than after the promise resolved.
    act(() => {
      linkAnchorsOf(container)[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      control.current?.zoomTo(2)
    })
    flushFrames()
    await settle()

    expect(control.current?.currentPage).toBe(1)
  })

  it('drops a destination that resolves after a reload superseded its layer', async () => {
    serveDocument(
      createFakeDocument({
        numPages: 12,
        destinations: { chapterTwo: [2, { name: 'XYZ' }] },
        annotations: { 1: [{ ...internalLink('a', 0), dest: 'chapterTwo' }] }
      })
    )
    const control: Control = { current: null }

    const { container, rerender } = render(
      <NativeViewerHarness
        reloadKey={0}
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))
    const layersBeforeReload = FakeAnnotationLayer.instances.length

    act(() => {
      linkAnchorsOf(container)[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
    })

    serveDocument(createFakeDocument({ numPages: 3, annotations: { 1: [internalLink('z', 0)] } }))
    rerender(
      <NativeViewerHarness
        reloadKey={1}
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await settle()

    // A new document, a new layer, and the previous document's link service gone with
    // it — so the in-flight destination cannot move the new document's page.
    expect(FakeAnnotationLayer.instances.length).toBeGreaterThan(layersBeforeReload)
    expect(
      FakeAnnotationLayer.instances.slice(0, layersBeforeReload).every((l) => l.isDestroyed())
    ).toBe(true)
    expect(control.current?.currentPage).toBe(1)
    expect(control.current?.annotationLayerError).toBe(null)
  })

  it('clears the DOM and destroys the layer on unmount', async () => {
    const document = createFakeDocument({
      numPages: 6,
      settleAnnotations: false,
      annotations: { 1: [internalLink('a', 0)] }
    })
    serveDocument(document)

    const { container, unmount } = render(<NativeViewerHarness />)
    await waitForFrames(() =>
      expect(document.page(1).getAnnotationsCalls.length).toBeGreaterThan(0)
    )

    const errors: unknown[] = []
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args)
    })

    unmount()

    expect(FakeAnnotationLayer.instances.every((layer) => layer.isDestroyed())).toBe(true)
    expect(annotationLayerOf(container)).toBe(null)

    // The pending lookup settles after teardown: nothing may publish or write after it.
    await act(async () => {
      document.page(1).settleAllAnnotations()
      await settle()
    })
    expect(consoleError).not.toHaveBeenCalled()
    expect(FakeAnnotationLayer.calls).toHaveLength(0)
    consoleError.mockRestore()
  })

  it('degrades the layer without taking the page down when annotations fail', async () => {
    const document = createFakeDocument({ numPages: 12, settleAnnotations: false })
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
      expect(document.page(1).getAnnotationsCalls.length).toBeGreaterThan(0)
    )

    await act(async () => {
      document.page(1).failLastAnnotations('annotation lookup failed')
      await settle()
    })

    expect(control.current?.annotationLayerError).toBe('annotation lookup failed')
    // Readable is not the same as selectable and linked, so the canvas and the text
    // layer stay up and the error shell stays down.
    expect(container.querySelector('[data-native-pdf-error]')).toBe(null)
    expect(container.querySelector('canvas')).not.toBe(null)
    expect(container.querySelector('[data-native-pdf-text-layer]')).not.toBe(null)
  })

  it('does not report a superseded lookup as a failure', async () => {
    const document = createFakeDocument({ numPages: 12, settleAnnotations: false })
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
      expect(document.page(1).getAnnotationsCalls.length).toBeGreaterThan(0)
    )

    // Move on, then let the abandoned page's lookup fail. That is not an error the
    // reader should ever hear about.
    act(() => control.current?.goToNextPage())
    await act(async () => {
      document.page(1).failLastAnnotations('too late')
      await settle()
    })
    await settle()

    expect(control.current?.annotationLayerError).toBe(null)
  })
})

/* ------------------------------------------------------------------ races */

describe('native annotation layer — races', () => {
  it('never lets a superseded document write annotations into the new page', async () => {
    const first = createFakeDocument({
      numPages: 12,
      settleAnnotations: false,
      annotations: { 1: [externalLink('old', 'https://old.example.com')] }
    })
    const second = createFakeDocument({
      numPages: 3,
      settleAnnotations: false,
      annotations: { 1: [internalLink('new', 0)] }
    })

    // PDF A really loads, and its annotation lookup is genuinely in flight when the
    // reader switches to PDF B.
    serveDocument(first)
    const { container, rerender } = render(<NativeViewerHarness pdfUrl="local-pdf://a" />)
    await waitForFrames(() => expect(first.page(1).getAnnotationsCalls.length).toBeGreaterThan(0))

    serveDocument(second)
    rerender(<NativeViewerHarness pdfUrl="local-pdf://b" />)
    await waitForFrames(() => expect(second.page(1).getAnnotationsCalls.length).toBeGreaterThan(0))
    const layersBeforeLateSettle = FakeAnnotationLayer.calls.length

    // Document A's annotation lookup finishes long after it was superseded, and while
    // document B's own lookup is still outstanding.
    await act(async () => {
      first.page(1).settleAllAnnotations()
      await settle()
    })

    // The abandoned run must build nothing at all — not even into a container that is
    // about to be reused for the next page.
    expect(FakeAnnotationLayer.calls.length).toBe(layersBeforeLateSettle)
    expect(annotationLayerOf(container)?.childElementCount).toBe(0)
    expect(linkAnchorsOf(container)).toHaveLength(0)
    expect(mocks.openExternal).not.toHaveBeenCalled()

    second.page(1).settleLastAnnotations()
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))
    expect(annotationLayerOf(container)).toHaveAttribute('data-native-pdf-annotation-page', '1')
    expect(annotationLayerOf(container)?.querySelector('[data-annotation-id="old"]')).toBeNull()
  })

  it('keeps the new page authoritative when the previous page resolves late', async () => {
    const document = createFakeDocument({
      numPages: 12,
      settleAnnotations: false,
      annotations: { 1: [internalLink('pageOne', 0)], 2: [internalLink('pageTwo', 0)] }
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
      expect(document.page(1).getAnnotationsCalls.length).toBeGreaterThan(0)
    )

    act(() => control.current?.goToNextPage())
    await waitForFrames(() =>
      expect(document.page(2).getAnnotationsCalls.length).toBeGreaterThan(0)
    )

    await act(async () => {
      document.page(1).settleAllAnnotations()
      await settle()
    })

    // The window that matters: page 2's lookup has not landed yet, so this is the whole
    // time a stale page-1 link would be sitting on top of page 2, waiting to be clicked.
    // It has to be empty.
    expect(annotationLayerOf(container)?.childElementCount).toBe(0)
    expect(linkAnchorsOf(container)).toHaveLength(0)

    document.page(2).settleLastAnnotations()

    await waitForFrames(() =>
      expect(annotationLayerOf(container)).toHaveAttribute('data-native-pdf-annotation-page', '2')
    )
    expect(
      annotationLayerOf(container)?.querySelector('[data-annotation-id="pageTwo"]')
    ).not.toBeNull()
    expect(annotationLayerOf(container)?.querySelector('[data-annotation-id="pageOne"]')).toBeNull()
  })
})

/* ------------------------------------------------------------ link clicks */

describe('native annotation layer — link clicks', () => {
  it('navigates the page through the controller for an internal destination', async () => {
    serveDocument(
      createFakeDocument({
        numPages: 12,
        // A 0-based index of 6 is QuizLab's page 7.
        annotations: { 1: [internalLink('a', 6)] }
      })
    )
    const control: Control = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))

    await act(async () => {
      linkAnchorsOf(container)[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      await settle()
    })

    expect(control.current?.currentPage).toBe(7)
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  it('does not navigate the app away for an internal link', async () => {
    serveDocument(createFakeDocument({ numPages: 12, annotations: { 1: [internalLink('a', 2)] } }))
    const { container } = render(<NativeViewerHarness />)
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))

    const hashBefore = window.location.hash
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    await act(async () => {
      linkAnchorsOf(container)[0].dispatchEvent(event)
      await settle()
    })

    // PDF.js's `onclick` returns `false`, which is how the anchor's fragment is
    // cancelled; the app's URL must be untouched.
    expect(event.defaultPrevented).toBe(true)
    expect(window.location.hash).toBe(hashBefore)
  })

  it('marks an internal link as internal and an external one as not', async () => {
    serveDocument(
      createFakeDocument({
        numPages: 12,
        annotations: {
          1: [internalLink('a', 1), externalLink('b', 'https://example.com')]
        }
      })
    )

    const { container } = render(<NativeViewerHarness />)
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(2))

    const layer = annotationLayerOf(container) as HTMLElement
    // `data-internal-link` is PDF.js's own marker for "this target is inside the
    // document", and it is the distinction a test — or a future handler — keys on.
    expect(layer.querySelector('[data-annotation-id="a"]')).toHaveAttribute('data-internal-link')
    expect(layer.querySelector('[data-annotation-id="b"]')).not.toHaveAttribute(
      'data-internal-link'
    )
  })

  it('resolves a named destination through the document lookup', async () => {
    serveDocument(
      createFakeDocument({
        numPages: 12,
        destinations: { chapterTwo: [2, { name: 'XYZ' }] },
        annotations: { 1: [{ ...internalLink('a', 0), dest: 'chapterTwo' }] }
      })
    )
    const control: Control = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))

    await act(async () => {
      linkAnchorsOf(container)[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      await settle()
    })

    expect(control.current?.currentPage).toBe(3)
  })

  it('leaves the reader where they are for a destination that does not resolve', async () => {
    serveDocument(
      createFakeDocument({
        numPages: 12,
        annotations: { 1: [{ ...internalLink('a', 0), dest: 'nowhere' }] }
      })
    )
    const control: Control = { current: null }
    const errors: unknown[] = []
    const onUnhandled = (event: PromiseRejectionEvent) => {
      errors.push(event.reason)
      event.preventDefault()
    }
    window.addEventListener('unhandledrejection', onUnhandled)

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))

    await act(async () => {
      linkAnchorsOf(container)[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      await settle()
    })
    await settle()

    // No crash, no unhandled rejection, and emphatically not a jump to page 1.
    expect(errors).toEqual([])
    expect(control.current?.currentPage).toBe(1)
    window.removeEventListener('unhandledrejection', onUnhandled)
  })

  it('opens an external link once through the app pathway', async () => {
    serveDocument(
      createFakeDocument({
        numPages: 12,
        annotations: { 1: [externalLink('a', 'https://example.com/docs')] }
      })
    )

    const { container } = render(<NativeViewerHarness />)
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))

    await act(async () => {
      linkAnchorsOf(container)[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      await settle()
    })

    expect(mocks.openExternal).toHaveBeenCalledTimes(1)
    expect(mocks.openExternal).toHaveBeenCalledWith('https://example.com/docs')
  })

  it.each([
    ['javascript', 'javascript:alert(document.cookie)'],
    ['file', 'file:///etc/passwd'],
    ['data', 'data:text/html,<script>alert(1)</script>']
  ])('never opens a %s URL and leaves nothing actionable behind', async (_label, url) => {
    serveDocument(
      createFakeDocument({ numPages: 12, annotations: { 1: [externalLink('a', url)] } })
    )

    const { container } = render(<NativeViewerHarness />)
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))
    const link = linkAnchorsOf(container)[0]

    await act(async () => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await settle()
    })

    expect(mocks.openExternal).not.toHaveBeenCalled()
    expect(link).not.toHaveAttribute('href')
  })

  it('activates an internal link with the keyboard on the same path', async () => {
    serveDocument(createFakeDocument({ numPages: 12, annotations: { 1: [internalLink('a', 3)] } }))
    const control: Control = { current: null }

    const { container } = render(
      <NativeViewerHarness
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))

    const link = linkAnchorsOf(container)[0]
    // An `<a href>` is focusable, which is what the hash is for.
    expect(link.hasAttribute('href')).toBe(true)
    expect(link.tabIndex).toBe(0)

    // Enter on a focused anchor dispatches a click, so there is exactly one
    // navigation path to get right.
    act(() => {
      link.focus()
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await settle()

    expect(control.current?.currentPage).toBe(4)
  })

  it('leaves text selection usable while the annotation layer is mounted', async () => {
    serveDocument(
      createFakeDocument({
        numPages: 12,
        textItems: { 1: ['first', 'second'] },
        annotations: { 1: [internalLink('a', 1)] }
      })
    )

    const { container } = render(
      <NativeViewerHarness textActions={{ onTextExtracted: () => {} }} />
    )
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))

    // The annotation layer owns its own box; the text layer is untouched, which is
    // what keeps selection — and therefore the AI text actions — working.
    const layer = annotationLayerOf(container) as HTMLElement
    expect(layer.querySelectorAll('[data-native-pdf-text-layer]')).toHaveLength(0)
    expect(
      container.querySelectorAll('[data-native-pdf-text-layer] span[role="presentation"]')
    ).toHaveLength(2)
  })

  it('keeps links clickable in pan mode, as the legacy viewer has them', async () => {
    serveDocument(createFakeDocument({ numPages: 12, annotations: { 1: [internalLink('a', 2)] } }))
    const control: Control = { current: null }

    const { container } = render(
      <NativeViewerHarness
        isPanMode
        onController={(c) => {
          control.current = c
        }}
      />
    )
    await waitForFrames(() => expect(linkAnchorsOf(container)).toHaveLength(1))

    // The legacy `_pdf-viewer.css` drops `user-select` in pan mode on the text layer
    // only and says nothing about the annotation layer, so under RPV a link stayed
    // live during a pan. Parity says keep it live here too; no pan rule touches the
    // annotation stylesheet.
    await act(async () => {
      linkAnchorsOf(container)[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      await settle()
    })

    expect(control.current?.currentPage).toBe(3)
  })
})

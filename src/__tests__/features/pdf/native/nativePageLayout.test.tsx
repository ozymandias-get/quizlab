/**
 * The native viewer's page layout contract.
 *
 * ## What is actually being protected
 *
 * Two invariants, both of which are pure CSS decisions made in
 * `features/pdf/ui/components/NativePdfViewer.tsx`:
 *
 *  1. **A page shorter than the available viewport is vertically centered.** Phase 8B
 *     left the scroll container on `items-start`, which is cross-axis *start*
 *     alignment, so a short page sat flush against the top with all the free space
 *     below it.
 *  2. **A page taller than the viewport still scrolls from its top edge.** This is the
 *     half that a careless fix breaks: `align-items: center` / `justify-content: center`
 *     overflow *equally in both directions* when free space is negative (CSS Flexbox
 *     §8.2/§8.3 `center`), so the overflow on the start side lands before the scroll
 *     container's scroll origin and the top of the page becomes unreachable.
 *
 * The mechanism that satisfies both at once is an auto margin on the page wrapper, which
 * the layout algorithm resolves *before* alignment: positive free space is distributed
 * into the margin (§9.5 main axis / §9.6 cross axis), and an overflowing item has its
 * start auto margin zeroed and overflows toward the end instead (§9.5, §8.1). So the
 * contract this file pins is not "the page is centered" — it is *how* the page is
 * centered, because the how is what keeps the scroll behaviour safe.
 *
 * ## The honest limit of these tests
 *
 * **jsdom performs no layout.** It has no box model: every element's
 * `getBoundingClientRect()` is `0×0`, `scrollHeight === clientHeight`, and no margin is
 * ever resolved. A test that fabricated page and viewport pixel geometry and asserted a
 * computed top offset would prove only that its own arithmetic agreed with itself — a
 * green suite that says nothing about what a browser paints, which is exactly the false
 * confidence this suite must not manufacture.
 *
 * So what is asserted here is the **structural layout contract**: which element scrolls,
 * which element owns the centering declaration, and which subtree moves with the page.
 * Those are the decisions a regression would undo, they are observable in jsdom, and they
 * are what the interactive smoke list in `docs/AGENT_HANDOFF.md` then confirms visually.
 *
 * ## What is deliberately *not* asserted
 *
 * No computed pixel geometry, and no simulation of the flexbox algorithm. Duplicating
 * §9.5/§9.6 in a test helper would only assert that the helper matches the spec the CSS
 * already follows, while drifting from it silently.
 */
import { NativeViewerHarness, type FakeDocument, createFakeDocument } from './nativeViewerHarness'
import { FakeAnnotationLayer } from './nativeAnnotationLayerDouble'
import { FakeTextLayer } from './nativeTextLayerDouble'

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { useNativePdfController } from '@features/pdf/native/useNativePdfController'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn()
}))

vi.mock('pdfjs-dist', async () => {
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

/**
 * Wait until every layer of one page is mounted, draining the rAF queue on the way.
 *
 * The fit scale and the coalesced zoom channel both commit on a frame, and the rAF stub
 * means frames only run when this says so.
 */
async function mountRenderedPage(
  onController?: (controller: ReturnType<typeof useNativePdfController>) => void
): Promise<HTMLElement> {
  const document: FakeDocument = createFakeDocument({ numPages: 4, width: 400, height: 600 })
  mocks.getDocument.mockImplementation(() => ({
    promise: Promise.resolve(document),
    destroy: vi.fn(),
    resolve: () => {},
    reject: () => {}
  }))

  const { container } = render(<NativeViewerHarness onController={onController} />)

  const deadline = Date.now() + 2000
  for (;;) {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    if (frameCallbacks.length > 0) {
      flushFrames()
      continue
    }
    const page = container.querySelector<HTMLElement>('[data-native-pdf-page]')
    const search = container.querySelector('[data-native-pdf-search-layer]')
    if (page && search) return container
    if (Date.now() > deadline) throw new Error('the native page never mounted')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

function classListOf(element: Element | null): string[] {
  return [...(element?.classList ?? [])]
}

describe('native page layout — the scroll container', () => {
  it('scrolls on the element that carries the scroll contract, not the page wrapper', async () => {
    const container = await mountRenderedPage()

    const scroll = container.querySelector<HTMLElement>('[data-native-pdf-scroll]')
    const page = container.querySelector<HTMLElement>('[data-native-pdf-page]')

    // The scroll container is the *parent* of the page wrapper, not the page wrapper
    // itself. An auto margin only resolves into free space in the box that owns the
    // scrolling, so this parent/child order is load-bearing rather than incidental.
    expect(scroll).not.toBe(null)
    expect(page?.parentElement).toBe(scroll)
    expect(classListOf(scroll)).toContain('overflow-auto')
  })

  it('does not center the scroll container itself, which would strand an overflowing page', async () => {
    const container = await mountRenderedPage()

    const scroll = container.querySelector<HTMLElement>('[data-native-pdf-scroll]')
    const classes = classListOf(scroll)

    // `center` on the scroll container overflows equally in both directions when free
    // space is negative, so the start-side overflow sits before the scroll origin and
    // the top of a tall page cannot be reached by scrolling. `items-start` is the safe
    // alignment; the free space is distributed by the page wrapper's auto margin instead.
    expect(classes).not.toContain('items-center')
    expect(classes).not.toContain('justify-center')
    // `stretch` is the other trap: it would grow the page box to the container's
    // height, leaving the auto margin no free space to absorb and inflating the box the
    // text and search layers are `inset: 0` against.
    expect(classes).not.toContain('items-stretch')
    expect(classes).toContain('items-start')
  })
})

describe('native page layout — the centering declaration', () => {
  it('puts the auto margin on the page wrapper, which is where both invariants come from', async () => {
    const container = await mountRenderedPage()

    const page = container.querySelector<HTMLElement>('[data-native-pdf-page]')

    // `m-auto` is the whole contract: it absorbs free space when there is some (short
    // page centers) and is zeroed when there is not (tall page scrolls from its top).
    expect(classListOf(page)).toContain('m-auto')
  })

  it('does not put the centering margin on the canvas', async () => {
    const container = await mountRenderedPage()

    const canvas = container.querySelector('[data-native-pdf-canvas]')

    // The margin belongs to the wrapper. A canvas-level margin would move the pixels
    // and leave the three overlays behind, which is precisely the desynchronisation the
    // shared page box exists to prevent.
    expect(classListOf(canvas)).not.toContain('m-auto')
    expect(classListOf(canvas)).not.toContain('my-auto')
    expect(classListOf(canvas)).not.toContain('mx-auto')
  })
})

describe('native page layout — the layers move as one', () => {
  it('keeps canvas, text layer, annotation layer and search overlay inside the centered box', async () => {
    const container = await mountRenderedPage()

    const page = container.querySelector<HTMLElement>('[data-native-pdf-page]')
    const layers = [
      '[data-native-pdf-canvas]',
      '[data-native-pdf-text-layer]',
      '[data-native-pdf-annotation-layer]',
      '[data-native-pdf-search-layer]'
    ]

    // Whatever the browser does with `m-auto`, it does it to this one box. If a layer
    // were a sibling of the page wrapper instead of a child, vertical centering would
    // desynchronise the canvas from the text runs, the link hitboxes and the search
    // highlights.
    for (const selector of layers) {
      const layer = page?.querySelector(selector)
      expect(layer, selector).not.toBe(null)
      expect(layer?.parentElement, selector).toBe(page)
    }
  })

  it('leaves no overlay outside the page wrapper to be left behind by the centering', async () => {
    const container = await mountRenderedPage()

    const scroll = container.querySelector<HTMLElement>('[data-native-pdf-scroll]')
    const page = container.querySelector<HTMLElement>('[data-native-pdf-page]')

    // The scroll container holds the page box and nothing else, so the auto margin has
    // exactly one box to distribute free space into.
    expect(scroll?.children.length).toBe(1)
    expect(scroll?.firstElementChild).toBe(page)
  })
})

describe('native page layout — centering is not a state transition', () => {
  it('keeps the centering declaration across a zoom step and a page change', async () => {
    const control: {
      current: { zoomTo: (scale: number) => void; goToNextPage: () => void } | null
    } = { current: null }

    const container = await mountRenderedPage((c) => {
      control.current = c
    })

    const pageOf = () => container.querySelector<HTMLElement>('[data-native-pdf-page]')
    expect(classListOf(pageOf())).toContain('m-auto')

    // Zoom out: the page gets shorter, so it becomes a "centered" page. The declaration
    // is unchanged — only the canvas size moved — so there is nothing to flicker and no
    // intermediate render in which the page is neither centered nor scrollable.
    act(() => control.current?.zoomTo(0.5))
    flushFrames()
    expect(classListOf(pageOf())).toContain('m-auto')

    // Zoom in past the viewport: now the overflow case. The same declaration resolves
    // to a zero start margin, which is what keeps the top edge reachable.
    act(() => control.current?.zoomTo(4))
    flushFrames()
    expect(classListOf(pageOf())).toContain('m-auto')

    // A page swap replaces the page box; the contract has to come back with it.
    act(() => control.current?.goToNextPage())
    flushFrames()
    const nextPage = pageOf()
    expect(nextPage).toHaveAttribute('data-native-pdf-page', '2')
    expect(classListOf(nextPage)).toContain('m-auto')
  })
})

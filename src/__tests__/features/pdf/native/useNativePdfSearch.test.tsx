/**
 * The native search lifecycle: one overlay, invalidated by everything that can move a
 * rectangle.
 *
 * This is the real `useNativePdfSearch` inside the real `useNativePdfController`,
 * mounted the way `PdfViewerDocument` mounts them, against the real harness. Only PDF.js
 * is faked (`TextLayer`, `AnnotationLayer`, the loading task), and layout is a declared
 * stand-in — see `nativeSearchGeometry`.
 *
 * What is under test is the lifecycle, which is where a search implementation actually
 * goes wrong:
 *
 *  - one overlay, always mounted, emptied and refilled
 *  - a query that survives a page change, because the legacy single-page path keeps it
 *  - a zoom, a reload, a document switch and an unmount all removing rectangles that no
 *    longer describe anything on screen
 *  - rapid queries leaving the *last* one visible
 *  - a failed search degrading to "no results", never to a broken page
 *  - the overlay staying out of the text layer and under the annotation layer, so
 *    selection, `Ctrl+C`, the AI text actions and link clicks are untouched
 */
import {
  type FakeDocument,
  NativeViewerHarness,
  createFakeDocument,
  createLoadingTask
} from './nativeViewerHarness'

import type { NativePdfController } from '@features/pdf/native/useNativePdfController'

import { act, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { highlightsIn, installNativeSearchGeometry, searchLayerOf } from './nativeSearchGeometry'

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

type HarnessProps = ComponentProps<typeof NativeViewerHarness>

/* ------------------------------------------------------------ rAF plumbing */

let pendingFrames: Map<number, FrameRequestCallback>

function flushFrames(): void {
  const frames = [...pendingFrames.entries()]
  pendingFrames.clear()
  act(() => {
    for (const [, cb] of frames) cb(0)
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
    if (pendingFrames.size > 0) {
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

/* --------------------------------------------------------------- fixtures */

function serve(document: FakeDocument): void {
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask({ abortOnDestroy: false })
    queueMicrotask(() => task.resolve(document))
    return task
  })
}

/**
 * Mount the harness and keep hold of the *latest* controller.
 *
 * The controller is memoised, so a captured reference goes stale the moment a search
 * publishes state — which is exactly when `searchError` has to be read.
 */
function mount(initial: HarnessProps = {}) {
  const latest = { current: null as NativePdfController | null }
  const onController = (value: NativePdfController) => {
    latest.current = value
  }
  const view = render(<NativeViewerHarness onController={onController} {...initial} />)
  return {
    view,
    rerender: (next: HarnessProps) =>
      view.rerender(<NativeViewerHarness onController={onController} {...next} />),
    get controller(): NativePdfController {
      if (!latest.current) throw new Error('the controller was never published')
      return latest.current
    },
    // Destructuring `controller` reads the getter once, so state a search publishes
    // afterwards has to be read through an accessor instead.
    searchError: () => {
      if (!latest.current) throw new Error('the controller was never published')
      return latest.current.searchError
    }
  }
}

/** The page box, once it exists, with the test's layout stand-in attached to it. */
async function mountWithGeometry(options: HarnessProps = {}) {
  const geometry = installNativeSearchGeometry()
  const mounted = mount(options)
  await waitForFrames(() => {
    const pageBox = mounted.view.container.querySelector('[data-native-pdf-page]')
    if (!pageBox) throw new Error('no page box yet')
    geometry.attachPageBox(pageBox as HTMLElement)
    // The runs have to exist too, or there is nothing to measure.
    if (!mounted.view.container.querySelector('[data-native-pdf-text-layer] span')) {
      throw new Error('no text runs yet')
    }
  })
  // The getter is re-declared rather than spread: a spread would freeze the controller at
  // mount time, and `searchError` only exists after a search has published state.
  return {
    view: mounted.view,
    geometry,
    rerender: mounted.rerender,
    get controller(): NativePdfController {
      return mounted.controller
    },
    searchError: () => mounted.controller.searchError
  }
}

function runSearch(controller: NativePdfController, keyword: string): void {
  act(() => controller.highlight(keyword))
}

function runClear(controller: NativePdfController): void {
  act(() => controller.clearHighlights())
}

let matchMediaSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  pendingFrames = new Map()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = pendingFrames.size + 1
    pendingFrames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pendingFrames.delete(id)
  })
  matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }) as unknown as MediaQueryList
  )
})

afterEach(() => {
  matchMediaSpy.mockRestore()
  vi.unstubAllGlobals()
})

/* ------------------------------------------------------------------ tests */

describe('native search overlay', () => {
  it('mounts exactly one overlay with the current page on it', async () => {
    serve(createFakeDocument({ numPages: 6, textItems: { 1: ['lupus'] } }))
    const { view, geometry } = await mountWithGeometry()

    expect(view.container.querySelectorAll('[data-native-pdf-search-layer]')).toHaveLength(1)
    const layer = searchLayerOf(view.container)
    // Present with no query: the overlay's identity does not change with the search state.
    expect(highlightsIn(layer)).toHaveLength(0)
    geometry.restore()
  })

  it('draws a rectangle for a single match', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['anti-phospholipid syndrome'] } }))
    const { view, controller, geometry } = await mountWithGeometry()

    runSearch(controller, 'phospho')

    const highlights = highlightsIn(searchLayerOf(view.container))
    expect(highlights).toHaveLength(1)
    expect(highlights[0].style.top).toBe('30px')
    // "phospho" starts five characters into the run, so its box starts partway across
    // the run's own box rather than at its left edge. The exact arithmetic is pinned in
    // `nativePdfSearch.test.ts`; here the point is that a rectangle lands on the match.
    expect(Number.parseFloat(highlights[0].style.left)).toBeGreaterThan(20)
    expect(highlights[0].dataset.nativePdfSearchMatch).toBe('0')
    geometry.restore()
  })

  it('draws one rectangle per match', async () => {
    serve(
      createFakeDocument({
        numPages: 4,
        textItems: { 1: ['lupus, and more lupus, and lupus again'] }
      })
    )
    const { view, controller, geometry } = await mountWithGeometry()

    runSearch(controller, 'lupus')

    const highlights = highlightsIn(searchLayerOf(view.container))
    expect(highlights).toHaveLength(3)
    expect(highlights.map((highlight) => highlight.dataset.nativePdfSearchMatch)).toEqual([
      '0',
      '1',
      '2'
    ])
    expect(highlights.map((highlight) => highlight.dataset.nativePdfSearchIndex)).toEqual([
      '0',
      '1',
      '2'
    ])
    geometry.restore()
  })

  it('draws one rectangle per run a multi-run keyword spans', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['romatoid', ' artrit'] } }))
    const { view, controller, geometry } = await mountWithGeometry()

    runSearch(controller, 'romatoid artrit')

    const highlights = highlightsIn(searchLayerOf(view.container))
    expect(highlights).toHaveLength(2)
    // Two boxes, one logical match — the split the legacy renderer also produces.
    expect(highlights.map((highlight) => highlight.dataset.nativePdfSearchMatch)).toEqual([
      '0',
      '0'
    ])
    geometry.restore()
  })

  it('leaves the overlay empty when nothing matches, without reporting an error', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus'] } }))
    const { view, controller, geometry, searchError } = await mountWithGeometry()

    runSearch(controller, 'sjogren')

    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(0)
    expect(searchError()).toBe(null)
    expect(view.container.querySelector('[data-native-pdf-error]')).toBe(null)
    geometry.restore()
  })

  it('has nothing to draw on a page with no text', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: [] } }))
    const geometry = installNativeSearchGeometry()
    const { view, controller, searchError } = mount()
    await waitForFrames(() => {
      const pageBox = view.container.querySelector('[data-native-pdf-page]')
      if (!pageBox) throw new Error('no page box yet')
      geometry.attachPageBox(pageBox as HTMLElement)
    })

    runSearch(controller, 'lupus')

    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(0)
    expect(searchError()).toBe(null)
    geometry.restore()
  })

  it('draws nothing for a whitespace-only keyword, even though the UI guards it', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus'] } }))
    const { view, controller, geometry } = await mountWithGeometry()

    runSearch(controller, '   ')

    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(0)
    geometry.restore()
  })

  it('keeps stable identities for the two toolbar callbacks', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus'] } }))
    const { controller, geometry } = await mountWithGeometry()

    const highlight = controller.highlight
    const clear = controller.clearHighlights
    runSearch(controller, 'lupus')
    flushFrames()
    runSearch(controller, 'nephritis')

    // `PdfToolbar` memoises on these, so a new identity on every render would re-render
    // the whole toolbar on every zoom frame.
    expect(controller.highlight).toBe(highlight)
    expect(controller.clearHighlights).toBe(clear)
    geometry.restore()
  })
})

describe('native search invalidation', () => {
  it('empties the overlay on clear, without touching the other layers', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus'] } }))
    const { view, controller, geometry } = await mountWithGeometry()

    runSearch(controller, 'lupus')
    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(1)

    runClear(controller)

    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(0)
    // The canvas, the text layer and the annotation layer are not search's to remove.
    expect(view.container.querySelector('[data-native-pdf-canvas]')).not.toBe(null)
    expect(view.container.querySelector('[data-native-pdf-text-layer] span')).not.toBe(null)
    expect(view.container.querySelector('[data-native-pdf-search-layer]')).not.toBe(null)
    geometry.restore()
  })

  it('leaves the last query visible when several arrive in a row', async () => {
    serve(
      createFakeDocument({
        numPages: 4,
        textItems: { 1: ['rheumatoid arthritis and rheumatoid fever'] }
      })
    )
    const { view, controller, geometry } = await mountWithGeometry()

    // Typed one character at a time, as the debounced toolbar search delivers it. The
    // counts fall 5 → 0 → 2, so a stale rectangle from an earlier query would show up as a
    // leftover rather than as a plausible-looking total.
    runSearch(controller, 'r')
    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(5)
    runSearch(controller, 'ra')
    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(0)
    runSearch(controller, 'rheumatoid')

    const highlights = highlightsIn(searchLayerOf(view.container))
    expect(highlights).toHaveLength(2)
    expect(highlights[0].getAttribute('title')).toBe('rheumatoid')
    geometry.restore()
  })

  it('keeps the query across a page change and redraws the new page', async () => {
    serve(
      createFakeDocument({
        numPages: 6,
        textItems: { 1: ['lupus on page one'], 2: ['lupus again on page two'] }
      })
    )
    const { view, controller, geometry } = await mountWithGeometry()

    runSearch(controller, 'lupus')
    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(1)

    act(() => controller.jumpToPage(2))
    await waitForFrames(() => {
      const layer = searchLayerOf(view.container)
      expect(highlightsIn(layer)).toHaveLength(1)
    })

    // Same query, the new page's runs, geometry measured from the new page box.
    expect(highlightsIn(searchLayerOf(view.container))[0].style.top).toBe('30px')
    geometry.restore()
  })

  it("never shows the previous page's rectangles", async () => {
    serve(
      createFakeDocument({
        numPages: 6,
        // Page 1 has five matches, page 2 has one.
        textItems: { 1: ['lupus lupus lupus lupus lupus'], 2: ['lupus'] }
      })
    )
    const { view, controller, geometry } = await mountWithGeometry()

    runSearch(controller, 'lupus')
    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(5)

    act(() => controller.jumpToPage(2))
    await waitForFrames(() => expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(1))
    geometry.restore()
  })

  it('drops rectangles whose runs are gone while the new page is still rendering', async () => {
    const document = createFakeDocument({
      numPages: 6,
      textItems: { 1: ['lupus on page one'], 2: ['lupus again'] },
      settleTextContent: false
    })
    serve(document)
    const geometry = installNativeSearchGeometry()
    const { view, controller } = mount()

    await waitForFrames(() => {
      if (document.page(1).getTextContentCalls.length === 0) throw new Error('no lookup yet')
      geometry.attachPageBox(view.container.querySelector<HTMLElement>('[data-native-pdf-page]')!)
      document.page(1).settleLastTextContent()
      if (!view.container.querySelector('[data-native-pdf-text-layer] span')) {
        throw new Error('no text runs yet')
      }
    })
    runSearch(controller, 'lupus')
    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(1)

    // The text layer is mid-rebuild: the container has been emptied but the new runs have
    // not arrived. A rectangle measured from runs that are gone must not stay on screen.
    act(() => controller.jumpToPage(2))
    await settle()
    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(0)

    // And it comes back, on the new page, once the new runs land.
    await act(async () => {
      document.page(2).settleAllTextContent()
    })
    await waitForFrames(() => expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(1))
    geometry.restore()
  })

  it('remeasures against the new viewport after a zoom', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus'] } }))
    const { view, controller, geometry } = await mountWithGeometry()

    runSearch(controller, 'lupus')
    expect(highlightsIn(searchLayerOf(view.container))[0].style.top).toBe('30px')

    // The same document at 150 %: every run is rebuilt and every box moves, so the old
    // rectangle is stale and the new one has to come from the new viewport.
    act(() => {
      controller.zoomTo(1.5)
      geometry.setScale(1.5)
    })
    await waitForFrames(() => {
      const highlight = highlightsIn(searchLayerOf(view.container))[0]
      expect(highlight).toBeDefined()
      expect(highlight.style.top).toBe('45px')
      expect(highlight.style.left).toBe('30px')
    })
    geometry.restore()
  })

  it('does not carry results from one document into the next', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus'] } }))
    const geometry = installNativeSearchGeometry()
    const { view, controller, rerender } = mount()

    await waitForFrames(() => {
      geometry.attachPageBox(view.container.querySelector<HTMLElement>('[data-native-pdf-page]')!)
      if (!view.container.querySelector('[data-native-pdf-text-layer] span')) {
        throw new Error('no text runs yet')
      }
    })
    runSearch(controller, 'lupus')
    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(1)

    // A different file, whose first page does not contain the word at all.
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['sjogren syndrome'] } }))
    rerender({ pdfUrl: 'local-pdf://b' })

    await waitForFrames(() => expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(0))
    geometry.restore()
  })

  it('drops every rectangle when the viewer is unmounted mid-search', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus'] } }))
    const { view, controller, geometry } = await mountWithGeometry()

    runSearch(controller, 'lupus')

    view.unmount()

    expect(document.querySelectorAll('[data-native-pdf-search-highlight]')).toHaveLength(0)
    // Nothing was scheduled, so there is nothing left to cancel or to fire into a dead
    // component; a stray frame callback would surface as an act() warning here.
    await settle()
    geometry.restore()
  })
})

describe('native search degradation', () => {
  it('keeps the page readable when the search cannot measure', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus nephritis'] } }))
    const { view, controller, geometry, searchError } = await mountWithGeometry()

    // A search that works, so the failure below is unambiguously the measurement and not
    // a page that never produced runs.
    runSearch(controller, 'lupus')
    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(1)

    const createRange = vi.spyOn(document, 'createRange').mockImplementation(() => {
      throw new Error('no range here')
    })
    runSearch(controller, 'nephritis')
    await settle()

    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(0)
    expect(searchError()).toBe('no range here')
    // A failed search is a degraded page, not a broken one: no error shell, and the canvas
    // and the text layer are still there.
    expect(view.container.querySelector('[data-native-pdf-error]')).toBe(null)
    expect(view.container.querySelector('[data-native-pdf-canvas]')).not.toBe(null)
    expect(view.container.querySelector('[data-native-pdf-text-layer] span')).not.toBe(null)

    // And it recovers once measuring works again. A different keyword, because the
    // controller owns the query: re-issuing the same one is not a new search.
    createRange.mockRestore()
    runSearch(controller, 'lupus')
    await settle()
    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(1)
    expect(searchError()).toBe(null)
    geometry.restore()
  })
})

describe('native search does not disturb the other layers', () => {
  it('keeps the overlay out of the text layer, so page text is unchanged', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus nephritis'] } }))
    const { view, controller, geometry } = await mountWithGeometry()

    runSearch(controller, 'lupus')

    const textLayer = view.container.querySelector<HTMLElement>('[data-native-pdf-text-layer]')!
    // The overlay is a sibling of the text layer. Were it inside, the extractors and
    // `Ctrl+C` would read the keyword back out of the highlight elements.
    expect(textLayer.querySelectorAll('[data-native-pdf-search-highlight]')).toHaveLength(0)
    expect(textLayer.textContent).toBe('lupus nephritis')
    geometry.restore()
  })

  it('keeps a link under a highlight clickable', async () => {
    serve(
      createFakeDocument({
        numPages: 4,
        textItems: { 1: ['lupus'] },
        annotations: {
          1: [{ id: 'link-0', annotationType: 2, rect: [0, 0, 200, 20], dest: ['doc', 'p', 1] }]
        }
      })
    )
    const { view, controller, geometry } = await mountWithGeometry()

    runSearch(controller, 'lupus')
    expect(highlightsIn(searchLayerOf(view.container))).toHaveLength(1)

    const anchor = view.container.querySelector<HTMLAnchorElement>(
      '[data-native-pdf-annotation-layer] a'
    )
    expect(anchor).not.toBe(null)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    anchor!.dispatchEvent(event)

    // The overlay is `pointer-events: none` in its own stylesheet, so a click over a
    // highlight still reaches the anchor and the annotation layer still navigates.
    expect(event.defaultPrevented).toBe(true)
    expect(anchor!.getAttribute('href')).toBeTruthy()
    geometry.restore()
  })
})
